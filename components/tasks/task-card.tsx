"use client";

import { useState } from "react";
import { Clock, ListChecks, MapPin, Repeat } from "lucide-react";
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
}

export function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onDragStart,
  onDragEnd,
  context,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const done = task.status === "done";
  const accent = PRIORITY_ACCENT[task.priority];
  const time = taskTimeLabel(task);
  const dur = durationLabel(taskDurationMin(task));
  const sub = subtaskProgress(task);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
        onDragStart?.(task);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd?.();
      }}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={cn(
        "group relative flex cursor-grab gap-2 overflow-hidden rounded-lg border bg-card p-2 pl-3 text-left shadow-sm transition-all hover:shadow-md hover:ring-1 active:cursor-grabbing",
        accent.ring,
        dragging && "opacity-40",
        done && "opacity-60"
      )}
    >
      {/* Priority color bar */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", accent.bar)}
      />

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
            "truncate text-[13px] font-medium leading-tight",
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
          {task.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {task.location}
            </span>
          )}
          {(task.recurrence || task.seriesId) && (
            <Repeat className="h-3 w-3" aria-label="Repeats" />
          )}
          {context && <span className="truncate">· {context}</span>}
        </div>

        {task.tags.length > 0 && (
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

      {/* Priority dot (visual anchor, top-right) */}
      <span
        aria-hidden
        className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", accent.dot)}
      />
    </div>
  );
}
