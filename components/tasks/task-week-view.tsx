"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRID_HOURS,
  gridHourFor,
  hourLabelShort,
  sortDayTasks,
} from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import type { Task } from "@/lib/types";

const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Time gutter + 7 equal day columns. Inline style so JIT can't drop the comma.
const GRID_COLS = "60px repeat(7, minmax(132px, 1fr))";

interface DayBuckets {
  allDay: Task[];
  byHour: Map<number, Task[]>;
}

interface Props {
  weekDates: string[]; // 7 keys, Monday-first
  today: string;
  tasksByDate: Map<string, Task[]>;
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onReschedule: (taskId: string, date: string, startMin: number | null) => void;
  onAdd: (date: string, startMin: number | null) => void;
}

export function TaskWeekView({
  weekDates,
  today,
  tasksByDate,
  goalTitle,
  onOpen,
  onToggleDone,
  onReschedule,
  onAdd,
}: Props) {
  const [over, setOver] = useState<string | null>(null); // `${date}|${lane}`

  // Bucket each day's tasks into an all-day list + per-hour rows, once.
  const buckets = useMemo(() => {
    const map = new Map<string, DayBuckets>();
    for (const key of weekDates) {
      const b: DayBuckets = { allDay: [], byHour: new Map() };
      for (const t of tasksByDate.get(key) ?? []) {
        if (t.startMin == null) {
          b.allDay.push(t);
        } else {
          const h = gridHourFor(t.startMin);
          const arr = b.byHour.get(h) ?? [];
          arr.push(t);
          b.byHour.set(h, arr);
        }
      }
      b.allDay = sortDayTasks(b.allDay);
      for (const [h, arr] of b.byHour) b.byHour.set(h, sortDayTasks(arr));
      map.set(key, b);
    }
    return map;
  }, [weekDates, tasksByDate]);

  function cell(
    key: string,
    laneId: string,
    startMin: number | null,
    tasks: Task[],
    minH: string
  ) {
    const cellKey = `${key}|${laneId}`;
    const isOver = over === cellKey;
    const isToday = key === today;
    return (
      <div
        key={cellKey}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (over !== cellKey) setOver(cellKey);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setOver((o) => (o === cellKey ? null : o));
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onReschedule(id, key, startMin);
        }}
        className={cn(
          "group/cell space-y-1 border-l border-t border-border/40 p-1 transition-colors",
          minH,
          isToday && "bg-primary/5",
          isOver && "bg-primary/10 ring-1 ring-inset ring-primary/50"
        )}
      >
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            compact
            onOpen={onOpen}
            onToggleDone={onToggleDone}
            context={goalTitle(t.goalId)}
          />
        ))}
        <button
          type="button"
          onClick={() => onAdd(key, startMin)}
          aria-label="Add task"
          className="flex w-full items-center justify-center rounded py-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/cell:opacity-100"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <div className="min-w-[960px]">
        {/* Day headers */}
        <div
          className="sticky top-0 z-10 grid bg-card"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="border-b border-border/40" />
          {weekDates.map((key) => {
            const d = new Date(key + "T00:00:00");
            const isToday = key === today;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-center gap-1.5 border-b border-l border-border/40 py-2 text-sm",
                  isToday ? "font-semibold text-primary" : "text-muted-foreground"
                )}
              >
                <span>{WD_SHORT[d.getDay()]}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    isToday &&
                      "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div className="grid" style={{ gridTemplateColumns: GRID_COLS }}>
          <div className="flex items-start justify-end border-t border-border/40 p-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            All-day
          </div>
          {weekDates.map((key) =>
            cell(key, "allday", null, buckets.get(key)?.allDay ?? [], "min-h-[44px]")
          )}
        </div>

        {/* Hour rows */}
        {GRID_HOURS.map((h) => (
          <div className="grid" style={{ gridTemplateColumns: GRID_COLS }} key={h}>
            <div className="flex items-start justify-end border-t border-border/40 p-1 pt-1.5 text-[11px] tabular-nums text-muted-foreground/70">
              {hourLabelShort(h)}
            </div>
            {weekDates.map((key) =>
              cell(key, String(h), h * 60, buckets.get(key)?.byHour.get(h) ?? [], "min-h-[46px]")
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
