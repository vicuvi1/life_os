// Shared task mutations for the planner screens (goal detail, Today, calendar),
// so rescheduling behaves identically everywhere.

import { updateTask } from "@/lib/firebase/db";
import { addTimeEntry, isAfterDeadline, timerElapsedMin } from "@/lib/planner";
import { toDateKey } from "@/lib/greeting";
import type { Goal, Task } from "@/lib/types";

/** The fields a reschedule changes — apply these to local state optimistically. */
export function reschedulePatch(
  date: string | null
): Pick<Task, "dueDate"> & Partial<Pick<Task, "startMin" | "endMin">> {
  // Unscheduling also drops the time block: a task with no day can't have a time.
  return date ? { dueDate: date } : { dueDate: null, startMin: null, endMin: null };
}

/** Move a task to another day (or `null` to unschedule it). */
export async function rescheduleTask(task: Pick<Task, "id">, date: string | null): Promise<void> {
  await updateTask(task.id, reschedulePatch(date));
}

/** Warning text when a day falls after the goal's deadline, else null. */
export function deadlineWarning(
  date: string | null,
  goal: Pick<Goal, "deadline" | "title"> | null | undefined
): string | null {
  if (!isAfterDeadline(date, goal) || !goal) return null;
  return `Heads up: that's after the deadline for “${goal.title}” (${goal.deadline}).`;
}

/** Start the stopwatch on a task. */
export async function startTaskTimer(task: Pick<Task, "id">, now = Date.now()): Promise<number> {
  await updateTask(task.id, { timerStartedAt: now });
  return now;
}

/** What stopping the timer changes — apply to local state optimistically. */
export function stopTimerPatch(
  task: Pick<Task, "timeLog" | "timerStartedAt">,
  now = Date.now()
): Pick<Task, "timeLog" | "timerStartedAt"> {
  if (task.timerStartedAt == null) return { timeLog: task.timeLog, timerStartedAt: null };
  return {
    timeLog: addTimeEntry(
      task.timeLog,
      toDateKey(new Date(now)),
      timerElapsedMin(task.timerStartedAt, now)
    ),
    timerStartedAt: null,
  };
}

/** Stop a task's timer and bank the elapsed minutes on today's log. */
export async function stopTaskTimer(
  task: Pick<Task, "id" | "timeLog" | "timerStartedAt">,
  now = Date.now()
): Promise<void> {
  await updateTask(task.id, stopTimerPatch(task, now));
}

/** Type in time by hand (e.g. you forgot to start the timer). */
export async function addTaskTime(
  task: Pick<Task, "id" | "timeLog">,
  date: string,
  minutes: number
): Promise<void> {
  await updateTask(task.id, { timeLog: addTimeEntry(task.timeLog, date, minutes) });
}
