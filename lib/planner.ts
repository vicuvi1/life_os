// Goals planner — the rules that turn goals into what to do each day.
// UI-free so the goals list, goal detail, Today and the calendar all agree.
//
// Dates are local "YYYY-MM-DD" keys throughout (never timestamps), so plain
// string comparison is a correct chronological comparison.

import { addDays } from "@/lib/habits";
import { sortMilestones } from "@/lib/goals";
import { taskDurationMin } from "@/lib/tasks";
import type { Goal, GoalMilestone, Session, Task, TaskTimeEntry } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Time actually spent.
// ---------------------------------------------------------------------------
type TimedTask = Pick<Task, "timeLog">;

/** Minutes logged on a task across all days. */
export function taskSpentMin(task: TimedTask): number {
  return task.timeLog.reduce((sum, e) => sum + (e.minutes > 0 ? e.minutes : 0), 0);
}

/** Add minutes to a task's log for one day (one entry per day, kept sorted). */
export function addTimeEntry(log: TaskTimeEntry[], date: string, minutes: number): TaskTimeEntry[] {
  if (!(minutes > 0)) return log;
  const existing = log.find((e) => e.date === date);
  const next = existing
    ? log.map((e) => (e.date === date ? { ...e, minutes: e.minutes + minutes } : e))
    : [...log, { date, minutes }];
  return next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Whole minutes a running timer has accumulated (at least 1 once started). */
export function timerElapsedMin(startedAt: number, now: number): number {
  return Math.max(1, Math.round((now - startedAt) / 60_000));
}

type TimedSession = Pick<Session, "goalId" | "date" | "startMin" | "endMin" | "status">;

function sessionMinutes(s: TimedSession): number {
  return s.status === "done" ? Math.max(0, s.endMin - s.startMin) : 0;
}

/** Minutes spent on a goal: its tasks' time logs plus completed linked Sessions. */
export function goalSpentMin(goalId: string, tasks: Task[], sessions: TimedSession[] = []): number {
  let total = 0;
  for (const t of tasks) if (t.goalId === goalId) total += taskSpentMin(t);
  for (const s of sessions) if (s.goalId === goalId) total += sessionMinutes(s);
  return total;
}

/**
 * Minutes spent per local day, optionally for one goal only — feeds the year
 * heatmap and the week / month totals.
 */
export function spentByDate(
  tasks: Task[],
  sessions: TimedSession[] = [],
  goalId?: string
): Map<string, number> {
  const map = new Map<string, number>();
  const add = (date: string, min: number) => {
    if (min > 0) map.set(date, (map.get(date) ?? 0) + min);
  };
  for (const t of tasks) {
    if (goalId && t.goalId !== goalId) continue;
    for (const e of t.timeLog) add(e.date, e.minutes);
  }
  for (const s of sessions) {
    if (goalId ? s.goalId !== goalId : !s.goalId) continue;
    add(s.date, sessionMinutes(s));
  }
  return map;
}

/** Sum a per-day map over an inclusive date range. */
export function sumRange(byDate: Map<string, number>, from: string, to: string): number {
  let total = 0;
  byDate.forEach((min, date) => {
    if (date >= from && date <= to) total += min;
  });
  return total;
}

export interface EstimateAccuracy {
  /** Finished tasks that have both an estimate and logged time. */
  sample: number;
  estimatedMin: number;
  spentMin: number;
  /** spent / estimated — 1.5 means things take 50% longer than you guess. */
  ratio: number;
}

/** How your estimates compare with reality, over finished tasks. Null with no data. */
export function estimateAccuracy(tasks: Task[]): EstimateAccuracy | null {
  let sample = 0;
  let estimatedMin = 0;
  let spentMin = 0;
  for (const t of tasks) {
    const spent = taskSpentMin(t);
    if (!isTaskDone(t) || !t.estimatedMinutes || spent <= 0) continue;
    sample += 1;
    estimatedMin += t.estimatedMinutes;
    spentMin += spent;
  }
  if (sample === 0 || estimatedMin <= 0) return null;
  return { sample, estimatedMin, spentMin, ratio: spentMin / estimatedMin };
}

// ---------------------------------------------------------------------------
// Goal timeline: start date, elapsed time, projected finish.
// ---------------------------------------------------------------------------
function diffDays(from: string, to: string): number {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** The day a goal started: its explicit start date, else the day it was created. */
export function goalStartDate(goal: Pick<Goal, "startDate" | "createdAt">, today: string): string {
  if (isDateKey(goal.startDate)) return goal.startDate;
  if (goal.createdAt > 0) {
    const d = new Date(goal.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    return key;
  }
  return today;
}

export interface GoalTimeline {
  start: string;
  /** Day number today, counting the start day as day 1 (0 if not started yet). */
  dayNumber: number;
  /** Total days from start to deadline inclusive; null with no deadline. */
  totalDays: number | null;
  /** Share of the available time already used, 0-100; null with no deadline. */
  timePercent: number | null;
  daysLeft: number | null;
}

export function goalTimeline(
  goal: Pick<Goal, "startDate" | "createdAt" | "deadline">,
  today: string
): GoalTimeline {
  const start = goalStartDate(goal, today);
  const dayNumber = Math.max(0, diffDays(start, today) + 1);
  if (!isDateKey(goal.deadline) || goal.deadline < start)
    return { start, dayNumber, totalDays: null, timePercent: null, daysLeft: null };
  const totalDays = diffDays(start, goal.deadline) + 1;
  const timePercent = Math.min(100, Math.max(0, Math.round((dayNumber / totalDays) * 100)));
  return { start, dayNumber, totalDays, timePercent, daysLeft: diffDays(today, goal.deadline) };
}

export interface GoalProjection {
  /** The day the last task would be finished at the current pace. */
  date: string;
  /** Days after (+) or before (−) the deadline; null with no deadline. */
  daysVsDeadline: number | null;
  tasksPerWeek: number;
}

/**
 * Projected finish from the pace so far: tasks finished since the start, spread
 * over the days elapsed, applied to the open tasks. Simple arithmetic — an
 * estimate, not a forecast. Null until at least 2 tasks are done or when
 * nothing is left.
 */
export function goalProjection(
  goal: Pick<Goal, "id" | "startDate" | "createdAt" | "deadline">,
  tasks: Task[],
  today: string
): GoalProjection | null {
  const stats = goalTaskStats(goal.id, tasks);
  const remaining = stats.total - stats.done;
  if (stats.done < 2 || remaining <= 0) return null;
  const elapsed = Math.max(1, diffDays(goalStartDate(goal, today), today) + 1);
  const perDay = stats.done / elapsed;
  const date = addDays(today, Math.ceil(remaining / perDay));
  return {
    date,
    daysVsDeadline: isDateKey(goal.deadline) ? diffDays(goal.deadline, date) : null,
    tasksPerWeek: Math.round(perDay * 7 * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Auto-plan: spread the backlog over the coming days without overloading any.
// ---------------------------------------------------------------------------
/** Assumed size of a task with no estimate when auto-planning. */
export const DEFAULT_TASK_MIN = 30;

export interface AutoPlanOptions {
  /** First day that may receive tasks. */
  from: string;
  limitMin: number;
  /** How many days ahead to look (default 60). */
  horizonDays?: number;
  /** Deadlines by goal id — earlier deadlines are planned first. */
  deadlines?: Map<string, string | null>;
}

/**
 * Give each unscheduled task the earliest day that still has room under the
 * daily limit, given what is already scheduled. A task bigger than the limit
 * goes on the first completely free day. Tasks that don't fit in the horizon
 * are left unscheduled.
 */
export function autoPlan(
  tasks: Task[],
  opts: AutoPlanOptions
): { taskId: string; date: string }[] {
  const horizon = opts.horizonDays ?? 60;
  const limit = opts.limitMin > 0 ? opts.limitMin : DEFAULT_DAILY_LIMIT_MIN;
  const load = new Map<string, number>();
  for (const t of tasks) {
    if (isTaskDone(t) || !t.dueDate) continue;
    load.set(t.dueDate, (load.get(t.dueDate) ?? 0) + taskEstimateMin(t));
  }
  const rank = (t: Task) => (t.goalId && opts.deadlines?.get(t.goalId)) || "9999-12-31";
  const backlog = tasks.filter(isTaskUnscheduled).sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
  const out: { taskId: string; date: string }[] = [];
  for (const t of backlog) {
    const size = taskEstimateMin(t) || DEFAULT_TASK_MIN;
    for (let i = 0; i < horizon; i++) {
      const day = addDays(opts.from, i);
      const used = load.get(day) ?? 0;
      if (used + size <= limit || (used === 0 && size > limit)) {
        load.set(day, used + size);
        out.push({ taskId: t.id, date: day });
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Long-range views: year roadmap, quarters, weekly review.
// ---------------------------------------------------------------------------
function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Position of a day within its year as a 0-100 percentage (start of that day). */
export function yearPercent(date: string, year: number): number {
  const days = isLeap(year) ? 366 : 365;
  return (diffDays(`${year}-01-01`, date) / days) * 100;
}

/**
 * Where a start→end span sits on a one-year timeline, as left / width
 * percentages, clipped to the year. Null when it doesn't touch the year.
 */
export function yearBar(
  start: string,
  end: string,
  year: number
): { left: number; width: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  if (end < start || end < first || start > last) return null;
  const from = start < first ? first : start;
  const to = end > last ? last : end;
  const left = yearPercent(from, year);
  // +1 day so a span ending on a date covers that whole day.
  const right = yearPercent(addDays(to, 1), year);
  return {
    left,
    width: Math.max(0.6, Math.min(100, right) - left),
    clippedStart: start < first,
    clippedEnd: end > last,
  };
}

export interface Quarter {
  year: number;
  q: 1 | 2 | 3 | 4;
  label: string; // "Q4 2026"
  start: string;
  end: string;
}

export function quarterOf(date: string): Quarter {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const q = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    q,
    label: `Q${q} ${year}`,
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

/** Whether a goal's start→deadline window overlaps a date range. */
export function goalOverlaps(
  goal: Pick<Goal, "startDate" | "createdAt" | "deadline">,
  from: string,
  to: string,
  today: string
): boolean {
  const start = goalStartDate(goal, today);
  const end = isDateKey(goal.deadline) ? goal.deadline : "9999-12-31";
  return start <= to && end >= from;
}

function msToKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export interface WeekReview {
  /** Tasks finished during the week. */
  done: Task[];
  /** Open tasks whose day has passed by the end of the week (or by yesterday). */
  slipped: Task[];
  /** Open tasks still scheduled later in the week (today onward). */
  remaining: Task[];
  spentMin: number;
}

/** What happened in the week starting `weekStart` (a Monday key). */
export function weekReview(
  tasks: Task[],
  sessions: TimedSession[],
  weekStart: string,
  today: string
): WeekReview {
  const weekEnd = addDays(weekStart, 6);
  const cutoff = weekEnd < today ? weekEnd : addDays(today, -1);
  const done: Task[] = [];
  const slipped: Task[] = [];
  const remaining: Task[] = [];
  for (const t of tasks) {
    if (isTaskDone(t)) {
      // Fall back to the scheduled day for tasks finished before timestamps existed.
      const when = t.completedAt ? msToKey(t.completedAt) : t.dueDate;
      if (when && when >= weekStart && when <= weekEnd) done.push(t);
    } else if (t.dueDate) {
      if (t.dueDate <= cutoff) slipped.push(t);
      else if (t.dueDate <= weekEnd) remaining.push(t);
    }
  }
  const byDate = new Map<string, number>();
  spentByDate(tasks).forEach((v, k) => byDate.set(k, v));
  for (const s of sessions) {
    const m = sessionMinutes(s);
    if (m > 0 && s.goalId) byDate.set(s.date, (byDate.get(s.date) ?? 0) + m);
  }
  return {
    done,
    slipped: sortPlanTasks(slipped),
    remaining: sortPlanTasks(remaining),
    spentMin: sumRange(byDate, weekStart, weekEnd),
  };
}
