// Goals planner — the rules that turn goals into what to do each day.
// UI-free so the goals list, goal detail, Today and the calendar all agree.
//
// Dates are local "YYYY-MM-DD" keys throughout (never timestamps), so plain
// string comparison is a correct chronological comparison.

import { addDays } from "@/lib/habits";
import { sortMilestones } from "@/lib/goals";
import { taskDurationMin } from "@/lib/tasks";
import type { Goal, GoalMilestone, Task } from "@/lib/types";

/** Default "don't overload a day" limit, in estimated minutes. */
export const DEFAULT_DAILY_LIMIT_MIN = 180;

/** Quick-pick estimates for the task quick-add. */
export const ESTIMATE_OPTIONS: number[] = [15, 30, 45, 60, 90, 120, 180];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a string is a well-formed local date key. */
export function isDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_KEY.test(value);
}

type TaskTiming = Pick<Task, "status" | "dueDate">;

export function isTaskDone(task: Pick<Task, "status">): boolean {
  return task.status === "done";
}

/** Open and scheduled before today. */
export function isTaskOverdue(task: TaskTiming, today: string): boolean {
  return !isTaskDone(task) && task.dueDate != null && task.dueDate < today;
}

/** Open with no day assigned — belongs in the backlog. */
export function isTaskUnscheduled(task: TaskTiming): boolean {
  return !isTaskDone(task) && !task.dueDate;
}

/**
 * Minutes a task is expected to take: its explicit estimate, else the length of
 * its time block, else 0 (unknown — it doesn't count toward the day's load).
 */
export function taskEstimateMin(
  task: Pick<Task, "estimatedMinutes" | "startMin" | "endMin">
): number {
  if (task.estimatedMinutes != null && task.estimatedMinutes > 0)
    return task.estimatedMinutes;
  return taskDurationMin(task) ?? 0;
}

/** Total estimated minutes of the given tasks (pass a single day's tasks). */
export function dayLoadMin(
  tasks: Pick<Task, "estimatedMinutes" | "startMin" | "endMin">[]
): number {
  return tasks.reduce((sum, t) => sum + taskEstimateMin(t), 0);
}

export function isOverLimit(loadMin: number, limitMin: number): boolean {
  return limitMin > 0 && loadMin > limitMin;
}

/** True when a day falls after the goal's deadline (worth a warning). */
export function isAfterDeadline(
  date: string | null | undefined,
  goal: Pick<Goal, "deadline"> | null | undefined
): boolean {
  return Boolean(date && goal?.deadline && date > goal.deadline);
}

// ---------------------------------------------------------------------------
// Per-goal task stats + health.
// ---------------------------------------------------------------------------
export interface GoalTaskStats {
  done: number;
  total: number;
  /** 0-100, or 0 when the goal has no tasks. */
  percent: number;
}

export function goalTaskStats(goalId: string, tasks: Task[]): GoalTaskStats {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.goalId !== goalId) continue;
    total += 1;
    if (isTaskDone(t)) done += 1;
  }
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/**
 * The tasks that belong to a milestone: those pointing at it via `milestoneId`,
 * plus any legacy links stored on the milestone itself (`linkedTaskIds`).
 */
export function milestoneTasks(milestone: GoalMilestone, goalTasks: Task[]): Task[] {
  const linked = new Set(milestone.linkedTaskIds);
  return goalTasks.filter((t) => t.milestoneId === milestone.id || linked.has(t.id));
}

export type GoalHealthStatus = "on_track" | "behind";

export interface GoalHealth {
  status: GoalHealthStatus;
  label: "On track" | "Behind";
  overdueTasks: number;
  /** Milestones whose date has passed while they still have open tasks. */
  missedMilestones: number;
  /** Plain-language reason, e.g. "2 overdue tasks · 1 milestone past its date". */
  reason: string | null;
}

/**
 * A goal is "behind" if it has overdue tasks, or a milestone date has passed
 * with open tasks. Otherwise it is "on track".
 */
export function goalHealth(
  goal: Pick<Goal, "id" | "milestones">,
  tasks: Task[],
  today: string
): GoalHealth {
  const goalTasks = tasks.filter((t) => t.goalId === goal.id);
  const overdueTasks = goalTasks.filter((t) => isTaskOverdue(t, today)).length;
  const missedMilestones = goal.milestones.filter(
    (m) =>
      m.dueDate != null &&
      m.dueDate < today &&
      milestoneTasks(m, goalTasks).some((t) => !isTaskDone(t))
  ).length;

  const parts: string[] = [];
  if (overdueTasks > 0)
    parts.push(`${overdueTasks} overdue ${overdueTasks === 1 ? "task" : "tasks"}`);
  if (missedMilestones > 0)
    parts.push(
      `${missedMilestones} ${missedMilestones === 1 ? "milestone" : "milestones"} past ${
        missedMilestones === 1 ? "its" : "their"
      } date`
    );
  const behind = parts.length > 0;
  return {
    status: behind ? "behind" : "on_track",
    label: behind ? "Behind" : "On track",
    overdueTasks,
    missedMilestones,
    reason: behind ? parts.join(" · ") : null,
  };
}

// ---------------------------------------------------------------------------
// Grouping for the goal-detail plan.
// ---------------------------------------------------------------------------
/** Milestones in date order (undated last), ties broken by manual order. */
export function milestonesByDate(milestones: GoalMilestone[]): GoalMilestone[] {
  return sortMilestones(milestones).sort((a, b) => {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
}

/** Open first, then by scheduled day (unscheduled last), then oldest first. */
export function sortPlanTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const doneA = isTaskDone(a) ? 1 : 0;
    const doneB = isTaskDone(b) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

export interface GoalPlan {
  groups: { milestone: GoalMilestone; tasks: Task[] }[];
  /** Tasks with no milestone (or pointing at one that no longer exists). */
  ungrouped: Task[];
  /** Open tasks with no day yet. */
  backlog: Task[];
}

/** Split a goal's tasks under its milestones (each task appears exactly once). */
export function buildGoalPlan(goal: Pick<Goal, "milestones">, goalTasks: Task[]): GoalPlan {
  const placed = new Set<string>();
  const groups = milestonesByDate(goal.milestones).map((milestone) => {
    const mine = milestoneTasks(milestone, goalTasks).filter((t) => !placed.has(t.id));
    for (const t of mine) placed.add(t.id);
    return { milestone, tasks: sortPlanTasks(mine) };
  });
  return {
    groups,
    ungrouped: sortPlanTasks(goalTasks.filter((t) => !placed.has(t.id))),
    backlog: sortPlanTasks(goalTasks.filter(isTaskUnscheduled)),
  };
}

// ---------------------------------------------------------------------------
// Small display helpers.
// ---------------------------------------------------------------------------
/** "45m", "1h", "1h 30m", or "" when there's no estimate. */
export function minutesLabel(min: number | null | undefined): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "Today", "Tomorrow", "Yesterday", else e.g. "Mon, Dec 1". */
export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  });
}
