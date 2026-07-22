"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  GRID_END_HOUR,
  GRID_HOURS,
  GRID_START_HOUR,
  hourLabelShort,
  layoutDayEvents,
  sortDayTasks,
} from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import type { Task } from "@/lib/types";

const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Spacious layout: tall hour rows + wide day columns.
const GUTTER_PX = 60;
const COL_MIN = 158;
const HOUR_PX = 88;
const START_MIN = GRID_START_HOUR * 60;
const END_MIN = (GRID_END_HOUR + 1) * 60;
const BODY_HEIGHT = GRID_HOURS.length * HOUR_PX;
const GRID_COLS = `${GUTTER_PX}px repeat(7, minmax(${COL_MIN}px, 1fr))`;
const MIN_WIDTH = GUTTER_PX + 7 * COL_MIN;

interface Props {
  weekDates: string[]; // 7 keys, Monday-first
  today: string;
  tasksByDate: Map<string, Task[]>;
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onReschedule: (taskId: string, date: string, startMin: number | null) => void;
  onResize: (taskId: string, endMin: number) => void;
  onAdd: (date: string, startMin: number | null) => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}
function yForMin(min: number) {
  return ((clamp(min, START_MIN, END_MIN) - START_MIN) / 60) * HOUR_PX;
}
/** Pointer Y within a column → a 30-min-snapped start minute. */
function minFromY(y: number) {
  const raw = START_MIN + (y / HOUR_PX) * 60;
  return clamp(Math.round(raw / 30) * 30, START_MIN, GRID_END_HOUR * 60);
}

export function TaskWeekView({
  weekDates,
  today,
  tasksByDate,
  goalTitle,
  onOpen,
  onToggleDone,
  onReschedule,
  onResize,
  onAdd,
}: Props) {
  const [overCol, setOverCol] = useState<string | null>(null);

  // --- Drag-to-resize (live duration edit) --------------------------------
  const sessionRef = useRef<{
    taskId: string;
    startMin: number;
    startEndMin: number;
    startY: number;
  } | null>(null);
  const [preview, setPreview] = useState<{ taskId: string; endMin: number } | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    function move(e: PointerEvent) {
      const s = sessionRef.current;
      if (!s) return;
      const deltaMin = Math.round(((e.clientY - s.startY) / HOUR_PX) * 60 / 15) * 15;
      const end = clamp(s.startEndMin + deltaMin, s.startMin + 15, END_MIN);
      setPreview({ taskId: s.taskId, endMin: end });
    }
    function up() {
      const s = sessionRef.current;
      if (!s) return;
      sessionRef.current = null;
      setPreview((p) => {
        if (p && p.endMin !== s.startEndMin) onResizeRef.current(s.taskId, p.endMin);
        return null;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  function startResize(e: React.PointerEvent, startMin: number, endMin: number, taskId: string) {
    e.preventDefault();
    e.stopPropagation();
    sessionRef.current = { taskId, startMin, startEndMin: endMin, startY: e.clientY };
    setPreview({ taskId, endMin });
  }

  const perDay = useMemo(() => {
    const map = new Map<string, { allDay: Task[]; events: ReturnType<typeof layoutDayEvents> }>();
    for (const key of weekDates) {
      const dayTasks = tasksByDate.get(key) ?? [];
      map.set(key, {
        allDay: sortDayTasks(dayTasks.filter((t) => t.startMin == null)),
        events: layoutDayEvents(dayTasks),
      });
    }
    return map;
  }, [weekDates, tasksByDate]);

  return (
    <div className={cn("overflow-x-auto rounded-2xl", preview && "select-none")}>
      <div style={{ minWidth: MIN_WIDTH }}>
        {/* Day headers */}
        <div
          className="sticky top-0 z-20 grid border-b border-border/50 bg-background/80 backdrop-blur"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div />
          {weekDates.map((key) => {
            const d = new Date(key + "T00:00:00");
            const isToday = key === today;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-sm transition-colors",
                  isToday ? "font-semibold text-primary" : "text-muted-foreground"
                )}
              >
                <span className="uppercase tracking-wide">{WD_SHORT[d.getDay()]}</span>
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
        <div className="grid border-b border-border/40" style={{ gridTemplateColumns: GRID_COLS }}>
          <div className="flex items-start justify-end p-2 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            All-day
          </div>
          {weekDates.map((key) => {
            const cellKey = `${key}|allday`;
            const isOver = overCol === cellKey;
            return (
              <div
                key={cellKey}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== cellKey) setOverCol(cellKey);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setOverCol((o) => (o === cellKey ? null : o));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverCol(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onReschedule(id, key, null);
                }}
                onClick={() => onAdd(key, null)}
                className={cn(
                  "min-h-[52px] space-y-1.5 p-1.5 transition-colors duration-150 ease-smooth",
                  key === today && "bg-primary/[0.04]",
                  isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40"
                )}
              >
                {(perDay.get(key)?.allDay ?? []).map((t) => (
                  <div key={t.id} onClick={(e) => e.stopPropagation()}>
                    <TaskCard
                      task={t}
                      compact
                      onOpen={onOpen}
                      onToggleDone={onToggleDone}
                      context={goalTitle(t.goalId)}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid body */}
        <div className="grid" style={{ gridTemplateColumns: GRID_COLS }}>
          {/* Time gutter */}
          <div className="relative" style={{ height: BODY_HEIGHT }}>
            {GRID_HOURS.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[12px] font-medium tabular-nums text-muted-foreground/60"
                style={{ top: i * HOUR_PX }}
              >
                {hourLabelShort(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((key) => {
            const isToday = key === today;
            const isOver = overCol === key;
            const events = perDay.get(key)?.events ?? [];
            return (
              <div
                key={key}
                title="Click an empty slot to add a task"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== key) setOverCol(key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setOverCol((o) => (o === key ? null : o));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverCol(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (!id) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onReschedule(id, key, minFromY(e.clientY - rect.top));
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onAdd(key, minFromY(e.clientY - rect.top));
                }}
                className={cn(
                  "relative cursor-copy border-l border-border/20 transition-colors duration-150 ease-smooth",
                  isToday && "bg-primary/[0.04]",
                  isOver && "bg-primary/[0.07] ring-1 ring-inset ring-primary/30"
                )}
                style={{ height: BODY_HEIGHT }}
              >
                {/* Hour gridlines */}
                {GRID_HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/15"
                    style={{ top: i * HOUR_PX }}
                  />
                ))}

                {/* Event blocks (duration-proportional; live resize) */}
                {events.map((ev) => {
                  const effEnd = preview?.taskId === ev.task.id ? preview.endMin : ev.endMin;
                  const top = yForMin(ev.startMin);
                  const height = Math.max(yForMin(effEnd) - top, 34);
                  const width = `calc(${100 / ev.cols}% - 6px)`;
                  const left = `calc(${(ev.col * 100) / ev.cols}% + 3px)`;
                  const isResizing = preview?.taskId === ev.task.id;
                  return (
                    <div
                      key={ev.task.id}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "group/ev absolute transition-[top,height] duration-150 ease-smooth",
                        isResizing && "z-30 transition-none"
                      )}
                      style={{ top: top + 2, height: height - 4, left, width }}
                    >
                      <TaskCard
                        task={ev.task}
                        compact
                        fill
                        onOpen={onOpen}
                        onToggleDone={onToggleDone}
                        context={goalTitle(ev.task.goalId)}
                      />
                      {/* Resize handle (drag to change duration) */}
                      <div
                        onPointerDown={(e) =>
                          startResize(e, ev.startMin, ev.endMin, ev.task.id)
                        }
                        onDragStart={(e) => e.preventDefault()}
                        draggable={false}
                        className={cn(
                          "absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover/ev:opacity-100",
                          isResizing && "opacity-100"
                        )}
                      >
                        <span className="h-1 w-8 rounded-full bg-foreground/30" />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
