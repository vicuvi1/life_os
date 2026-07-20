import type { Habit, Session, Task } from "@/lib/types";

/**
 * A single row in the dashboard's Priority Stack. Each variant carries exactly
 * the data its row needs to render an inline quick-action (no click-through
 * required for simple logging).
 */
export type PriorityItem =
  | { kind: "monday" }
  | { kind: "sleep" }
  | { kind: "habits"; remaining: Habit[]; total: number }
  | { kind: "water" }
  | { kind: "tasks"; due: Task[] }
  | { kind: "session"; session: Session };

export interface PriorityInput {
  isMonday: boolean;
  reviewDoneThisWeek: boolean;
  sleepLoggedToday: boolean;
  habitsRemaining: Habit[];
  habitsTotal: number;
  water: number;
  waterTarget: number;
  tasksDueToday: Task[];
  /** Next planned, not-yet-started session today (or null). */
  nextSession: Session | null;
}

/**
 * Build the ordered Priority Stack: time-sensitive nudges first, then the
 * single highest-impact unlogged metric (sleep drives focus scoring), then
 * remaining daily trackers, then tasks due today. Pure and deterministic.
 */
export function buildPriorityStack(input: PriorityInput): PriorityItem[] {
  const items: PriorityItem[] = [];

  // 1. Time-sensitive nudges.
  if (input.isMonday && !input.reviewDoneThisWeek) {
    items.push({ kind: "monday" });
  }

  // 2. The single highest-impact unlogged metric.
  if (!input.sleepLoggedToday) {
    items.push({ kind: "sleep" });
  }

  // 3. Remaining daily trackers not yet logged.
  if (input.habitsRemaining.length > 0) {
    items.push({
      kind: "habits",
      remaining: input.habitsRemaining,
      total: input.habitsTotal,
    });
  }
  if (input.water < input.waterTarget) {
    items.push({ kind: "water" });
  }

  // 4. Open tasks due today.
  if (input.tasksDueToday.length > 0) {
    items.push({ kind: "tasks", due: input.tasksDueToday });
  }

  // An upcoming session is informational context, appended after the four
  // core categories above.
  if (input.nextSession) {
    items.push({ kind: "session", session: input.nextSession });
  }

  return items;
}
