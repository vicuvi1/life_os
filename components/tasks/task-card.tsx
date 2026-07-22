"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, ListChecks, MapPin, Repeat, Target, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  PRIORITY_ACCENT,
  durationLabel,
  subtaskProgress,
  taskDurationMin,
  taskTimeLabel,
} from "@/lib/tasks";
import type { Task } from "@/lib/types";

interface Props {
  task: Task;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
  /** Trailing context, e.g. the goal title. */
  context?: string | null;
  /** Dense variant for the week time-grid cells. */
  compact?: boolean;
  /** Fill the parent's height (duration-proportional block in the week grid). */
  fill?: boolean;
}

interface HoverPos {
  top: number;
  left: number;
}

export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onDragStart,
  onDragEnd,
  context,
  compact,
  fill,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<HoverPos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const done = task.status === "done";
  const accent = PRIORITY_ACCENT[task.priority];
  const time = taskTimeLabel(task);
  const dur = durationLabel(taskDurationMin(task));
  const sub = subtaskProgress(task);

  function openHover() {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const W = 264;
    const H = 240; // estimate for placement only
    let left = r.right + 8;
    if (left + W > window.innerWidth - 8) left = r.left - W - 8; // flip to left
    if (left < 8) left = Math.min(r.left, window.innerWidth - W - 8);
    let top = r.top;
    if (top + H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - H - 8);
    setHover({ top, left });
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
        setHover(null);
        onDragStart?.(task);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd?.();
      }}
      onMouseEnter={openHover}
      onMouseLeave={() => setHover(null)}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={cn(
        "group relative flex cursor-grab gap-2 overflow-hidden rounded-lg border text-left shadow-sm transition-all hover:shadow-md hover:ring-1 active:cursor-grabbing",
        accent.soft,
        accent.ring,
        compact ? "p-1.5 pl-2.5" : "p-2 pl-3",
        fill && "h-full",
        dragging && "opacity-40",
        done && "opacity-60"
      )}
    >
      {/* Priority color bar */}
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} />

      <span
        className="mt-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={done}
          onCheckedChange={(c) => onToggleDone(task, Boolean(c))}
          aria-label={done ? "Mark as not done" : "Mark as done"}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium leading-tight",
            compact ? "text-[12px]" : "text-[13px]",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {time}
              {dur && <span className="text-muted-foreground/70">· {dur}</span>}
            </span>
          )}
          {sub.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {sub.done}/{sub.total}
            </span>
          )}
          {(task.recurrence || task.seriesId) && (
            <Repeat className="h-3 w-3" aria-label="Repeats" />
          )}
          {!compact && task.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {task.location}
            </span>
          )}
          {!compact && context && <span className="truncate">· {context}</span>}
        </div>

        {!compact && task.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <span aria-hidden className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", accent.dot)} />

      {/* Hover preview (portaled so the scrolling grid can't clip it) */}
      {hover &&
        !dragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ position: "fixed", top: hover.top, left: hover.left, width: 264 }}
            className="pointer-events-none z-[70] rounded-xl border bg-card p-3 shadow-xl"
          >
            <div className="flex items-start gap-2">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", accent.dot)} />
              <p className="text-sm font-semibold leading-tight">{task.title}</p>
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <PreviewRow label="Priority" value={accent.label} />
              {time && <PreviewRow label="Time" value={`${time}${dur ? ` · ${dur}` : ""}`} icon={<Clock className="h-3 w-3" />} />}
              {context && <PreviewRow label="Goal" value={context} icon={<Target className="h-3 w-3" />} />}
              {task.energy != null && <PreviewRow label="Energy" value={`${task.energy}/10`} icon={<Zap className="h-3 w-3" />} />}
              {task.location && <PreviewRow label="Location" value={task.location} icon={<MapPin className="h-3 w-3" />} />}
            </div>
            {task.subtasks.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t pt-2">
                {task.subtasks.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        "flex h-3 w-3 items-center justify-center rounded-[3px] border text-[8px]",
                        s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"
                      )}
                    >
                      {s.done ? "✓" : ""}
                    </span>
                    <span className={cn("truncate", s.done && "text-muted-foreground line-through")}>
                      {s.title}
                    </span>
                  </div>
                ))}
                {task.subtasks.length > 4 && (
                  <p className="text-[11px] text-muted-foreground">
                    +{task.subtasks.length - 4} more
                  </p>
                )}
              </div>
            )}
            {task.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground/60">Click to open · drag to reschedule</p>
          </div>,
          document.body
        )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
