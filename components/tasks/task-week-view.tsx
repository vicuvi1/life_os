"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_LANES, laneForTask, sortDayTasks, type LaneKey } from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import type { Task } from "@/lib/types";

const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  weekDates: string[]; // 7 keys, Monday-first
  today: string;
  tasksByDate: Map<string, Task[]>;
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onReschedule: (taskId: string, date: string, lane: LaneKey) => void;
  onAdd: (date: string, lane: LaneKey) => void;
}

// Fixed label column + 7 equal day columns. Inline style (not an arbitrary
// Tailwind class) so JIT extraction can never drop the comma-bearing value.
const GRID_COLS = "76px repeat(7, minmax(150px, 1fr))";

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

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[980px]">
        {/* Day headers */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: GRID_COLS }}>
          <div />
          {weekDates.map((key) => {
            const d = new Date(key + "T00:00:00");
            const isToday = key === today;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm",
                  isToday
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                )}
              >
                <span>{WD_SHORT[d.getDay()]}</span>
                <span className="tabular-nums">{d.getDate()}</span>
              </div>
            );
          })}
        </div>

        {/* Lanes × days */}
        <div className="mt-1.5 space-y-1.5">
          {DAY_LANES.map((lane) => (
            <div
              key={lane.key}
              className="grid gap-1.5"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div className="flex flex-col justify-start pt-1.5 pr-1 text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {lane.label}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {lane.hint}
                </span>
              </div>

              {weekDates.map((key) => {
                const cellKey = `${key}|${lane.key}`;
                const cellTasks = sortDayTasks(
                  (tasksByDate.get(key) ?? []).filter(
                    (t) => laneForTask(t) === lane.key
                  )
                );
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
                      // Only clear when leaving the cell itself, not a child.
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setOver((o) => (o === cellKey ? null : o));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) onReschedule(id, key, lane.key);
                    }}
                    className={cn(
                      "group/cell min-h-[64px] space-y-1.5 rounded-lg border border-dashed border-transparent p-1 transition-colors",
                      isToday && "bg-muted/30",
                      isOver && "border-primary/60 bg-primary/5"
                    )}
                  >
                    {cellTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onOpen={onOpen}
                        onToggleDone={onToggleDone}
                        context={goalTitle(t.goalId)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => onAdd(key, lane.key)}
                      className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/cell:opacity-100"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
