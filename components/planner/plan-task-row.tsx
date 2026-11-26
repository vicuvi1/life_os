"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  Clock,
  MoreVertical,
  Play,
  Square,
  Timer,
  Pencil,
  Sun,
  Sunrise,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDays } from "@/lib/habits";
import {
  isAfterDeadline,
  isTaskDone,
  isTaskOverdue,
  minutesLabel,
  relativeDayLabel,
  taskEstimateMin,
  taskSpentMin,
  timerElapsedMin,
} from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Goal, Task } from "@/lib/types";

interface Props {
  task: Task;
  /** The task's goal — drives the deadline warning and the color dot. */
  goal?: Pick<Goal, "deadline" | "color"> | null;
  today: string;
  onToggleDone: (task: Task, done: boolean) => void;
  /** `null` unschedules the task (back to the backlog). */
  onReschedule: (task: Task, date: string | null) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Start / stop the task's stopwatch. Omit to hide time tracking. */
  onToggleTimer?: (task: Task) => void;
  /** Log minutes by hand (for when the timer wasn't running). */
  onAddTime?: (task: Task, minutes: number) => void;
  /** Optional trailing context (e.g. the milestone or goal title). */
  context?: string | null;
  showGoalDot?: boolean;
}

/**
 * One task in the planner: tick it off, see its day and estimate, and move it
 * to another day without drag and drop (date chip or the ⋯ menu).
 */
export function PlanTaskRow({
  task,
  goal,
  today,
  onToggleDone,
  onReschedule,
  onEdit,
  onDelete,
  onToggleTimer,
  onAddTime,
  context,
  showGoalDot = false,
}: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const done = isTaskDone(task);
  const overdue = isTaskOverdue(task, today);
  const late = !done && isAfterDeadline(task.dueDate, goal);
  const estimate = minutesLabel(taskEstimateMin(task));
  const tomorrow = addDays(today, 1);
  const running = task.timerStartedAt != null;
  // Re-render while the timer runs so the elapsed time stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [running]);
  const spentMin =
    taskSpentMin(task) +
    (task.timerStartedAt != null ? timerElapsedMin(task.timerStartedAt, now) : 0);
  const spent = minutesLabel(spentMin);
  const overEstimate =
    task.estimatedMinutes != null && task.estimatedMinutes > 0 && spentMin > task.estimatedMinutes;

  function openPicker() {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through to focus */
      }
    }
    el.focus();
    el.click();
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 sm:px-4">
      <Checkbox
        className="mt-0.5"
        checked={done}
        onCheckedChange={(c) => onToggleDone(task, Boolean(c))}
        aria-label={done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("break-words text-sm", done && "text-muted-foreground line-through")}>
          {showGoalDot && (
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: goal?.color ?? "hsl(var(--muted-foreground))" }}
            />
          )}
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="relative inline-flex">
            <button
              type="button"
              onClick={openPicker}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-colors hover:border-primary/50 hover:text-foreground",
                !task.dueDate && "border-dashed",
                overdue && "border-destructive/40 text-destructive"
              )}
              aria-label={
                task.dueDate
                  ? `Scheduled ${relativeDayLabel(task.dueDate, today)} — change day`
                  : "Unscheduled — pick a day"
              }
            >
              <CalendarDays className="h-3 w-3" />
              {task.dueDate ? relativeDayLabel(task.dueDate, today) : "Unscheduled"}
              {overdue && " · overdue"}
            </button>
            <input
              ref={dateRef}
              type="date"
              tabIndex={-1}
              aria-hidden
              value={task.dueDate ?? ""}
              onChange={(e) => onReschedule(task, e.target.value || null)}
              className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
            />
          </span>
          {estimate && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {estimate}
            </span>
          )}
          {spent && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                running && "font-medium text-primary",
                !running && overEstimate && "text-amber-600 dark:text-amber-400"
              )}
              title={overEstimate ? "Took longer than estimated" : undefined}
            >
              <Timer className="h-3 w-3" />
              {spent} {running ? "· running" : "spent"}
            </span>
          )}
          {late && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              After deadline
            </span>
          )}
          {context && <span className="truncate">· {context}</span>}
        </div>
      </div>

      {onToggleTimer && !done && (
        <Button
          variant={running ? "default" : "ghost"}
          size="icon"
          className={cn("h-8 w-8 shrink-0", !running && "text-muted-foreground")}
          onClick={() => onToggleTimer(task)}
          aria-label={running ? `Stop timer for “${task.title}”` : `Start timer for “${task.title}”`}
          aria-pressed={running}
        >
          {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-4 w-4" />}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 h-8 w-8 shrink-0 text-muted-foreground"
            aria-label={`Actions for “${task.title}”`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {task.dueDate !== today && (
            <DropdownMenuItem onClick={() => onReschedule(task, today)}>
              <Sun className="h-4 w-4" /> Move to today
            </DropdownMenuItem>
          )}
          {task.dueDate !== tomorrow && (
            <DropdownMenuItem onClick={() => onReschedule(task, tomorrow)}>
              <Sunrise className="h-4 w-4" /> Move to tomorrow
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={openPicker}>
            <CalendarDays className="h-4 w-4" /> Pick a day…
          </DropdownMenuItem>
          {task.dueDate && (
            <DropdownMenuItem onClick={() => onReschedule(task, null)}>
              <CalendarOff className="h-4 w-4" /> Unschedule
            </DropdownMenuItem>
          )}
          {onAddTime && (
            <>
              <DropdownMenuItem onClick={() => onAddTime(task, 15)}>
                <Timer className="h-4 w-4" /> Log 15 min
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddTime(task, 30)}>
                <Timer className="h-4 w-4" /> Log 30 min
              </DropdownMenuItem>
            </>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(task)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
