// Shared task mutations for the planner screens (goal detail, Today, calendar),
// so rescheduling behaves identically everywhere.

import { updateTask } from "@/lib/firebase/db";
import { isAfterDeadline } from "@/lib/planner";
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
