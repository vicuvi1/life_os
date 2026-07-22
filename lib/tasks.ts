// Task planner domain logic — the calendar/Notion-style Tasks experience.
// Kept framework-free so views stay thin. Scheduling reuses the Session
// vocabulary (minutes since midnight) and the helpers in lib/sessions.ts.

import type {
  Priority,
  Subtask,
  Task,
  TaskRecurrence,
  TaskRecurrenceFreq,
} from "@/lib/types";
import { minToLabel } from "@/lib/sessions";
import { addDays } from "@/lib/habits";

// ---------------------------------------------------------------------------
// Time-of-day blocks — the rows of the week grid and the Today schedule.
// ---------------------------------------------------------------------------
export type BlockKey = "morning" | "afternoon" | "evening";
/** Includes the pseudo-block for dated-but-untimed tasks. */
export type LaneKey = "allday" | BlockKey;

export interface DayBlock {
  key: BlockKey;
  label: string;
  hint: string;
  startMin: number;
  endMin: number;
}

export const DAY_BLOCKS: DayBlock[] = [
  { key: "morning", label: "Morning", hint: "6am – 12pm", startMin: 6 * 60, endMin: 12 * 60 },
  { key: "afternoon", label: "Afternoon", hint: "12pm – 5pm", startMin: 12 * 60, endMin: 17 * 60 },
  { key: "evening", label: "Evening", hint: "5pm – 11pm", startMin: 17 * 60, endMin: 23 * 60 },
];

/** All lanes shown in a day column, in top-to-bottom order. */
export const DAY_LANES: { key: LaneKey; label: string; hint: string }[] = [
  { key: "allday", label: "All day", hint: "No set time" },
  ...DAY_BLOCKS.map((b) => ({ key: b.key, label: b.label, hint: b.hint })),
];

/** Which lane a task belongs to on its day, from its start time. */
export function laneForTask(task: Pick<Task, "startMin">): LaneKey {
  const s = task.startMin;
  if (s == null) return "allday";
  if (s < DAY_BLOCKS[1].startMin) return "morning";
  if (s < DAY_BLOCKS[2].startMin) return "afternoon";
  return "evening";
}

/**
 * Compute the (startMin, endMin) a task should take when dropped into a lane.
 * Preserves the task's existing duration when it has one; otherwise defaults to
 * a 1-hour block anchored at the lane's start. Dropping onto "All day" clears
 * the time so the task becomes untimed.
 */
export function scheduleForLane(
  task: Pick<Task, "startMin" | "endMin">,
  lane: LaneKey
): { startMin: number | null; endMin: number | null } {
  if (lane === "allday") return { startMin: null, endMin: null };
  const block = DAY_BLOCKS.find((b) => b.key === lane)!;
  const existing = taskDurationMin(task);
  const dur = existing ?? 60;
  const startMin = block.startMin;
  const endMin = Math.min(startMin + dur, 24 * 60);
  return { startMin, endMin };
}

// ---------------------------------------------------------------------------
// Hourly grid — the true week time-grid view (TIME rows × day columns).
// ---------------------------------------------------------------------------
export const GRID_START_HOUR = 6; // first row (6 AM)
export const GRID_END_HOUR = 22; // last row (10 PM)
export const GRID_HOURS: number[] = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => GRID_START_HOUR + i
);

/** Compact hour label for the time gutter, e.g. "6am", "12pm", "5pm". */
export function hourLabelShort(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}

/** Which hour row a timed task sits in, clamped into the visible grid. */
export function gridHourFor(startMin: number): number {
  return Math.min(
    GRID_END_HOUR,
    Math.max(GRID_START_HOUR, Math.floor(startMin / 60))
  );
}

/**
 * Resolve a task's schedule when moved to a target start (minutes) or to the
 * all-day lane (null), preserving its existing duration (default 1h).
 */
export function scheduleAtMin(
  task: Pick<Task, "startMin" | "endMin">,
  startMin: number | null
): { startMin: number | null; endMin: number | null } {
  if (startMin == null) return { startMin: null, endMin: null };
  const dur = taskDurationMin(task) ?? 60;
  return { startMin, endMin: Math.min(startMin + dur, 24 * 60) };
}

// ---------------------------------------------------------------------------
// Workload — month-view intensity (□ / ■ / ■■).
// ---------------------------------------------------------------------------
export type Workload = "none" | "light" | "normal" | "heavy";

/** A day's load from its open tasks' total blocked (or estimated) time. */
export function dayWorkload(tasks: Task[]): Workload {
  const open = tasks.filter((t) => t.status !== "done");
  if (open.length === 0) return "none";
  const mins = open.reduce((s, t) => s + (taskDurationMin(t) ?? 60), 0);
  const hours = mins / 60;
  if (hours >= 6) return "heavy";
  if (hours >= 2) return "normal";
  return "light";
}

export const WORKLOAD_BARS: Record<Workload, number> = {
  none: 0,
  light: 1,
  normal: 2,
  heavy: 3,
};

// ---------------------------------------------------------------------------
// Priority accents — color-coding by priority (🔴 high / 🟡 medium / 🟢 low).
// Static class strings only, so Tailwind's JIT keeps them.
// ---------------------------------------------------------------------------
export interface PriorityAccent {
  dot: string;
  bar: string;
  chip: string;
  ring: string;
  label: string;
}

export const PRIORITY_ACCENT: Record<Priority, PriorityAccent> = {
  high: {
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/40",
    label: "High",
  },
  medium: {
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
    label: "Medium",
  },
  low: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    label: "Low",
  },
};

/** Weight for sorting (high first). */
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Duration helpers.
// ---------------------------------------------------------------------------
export const DURATION_OPTIONS: { min: number; label: string }[] = [
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 45, label: "45 min" },
  { min: 60, label: "1 hour" },
  { min: 90, label: "1.5 hours" },
  { min: 120, label: "2 hours" },
  { min: 180, label: "3 hours" },
  { min: 240, label: "4 hours" },
];

/** Scheduled duration in minutes, or null if the task isn't time-blocked. */
export function taskDurationMin(
  task: Pick<Task, "startMin" | "endMin">
): number | null {
  if (task.startMin == null || task.endMin == null) return null;
  const d = task.endMin - task.startMin;
  return d > 0 ? d : null;
}

/** "2h", "45min", "1h 30min", or "" for zero/absent. */
export function durationLabel(min: number | null): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** Compact time range for a card, e.g. "7:00 AM – 9:00 AM" (no duration). */
export function taskTimeLabel(
  task: Pick<Task, "startMin" | "endMin">
): string | null {
  if (task.startMin == null) return null;
  if (task.endMin == null) return minToLabel(task.startMin);
  return `${minToLabel(task.startMin)} – ${minToLabel(task.endMin)}`;
}

// ---------------------------------------------------------------------------
// Sorting & grouping.
// ---------------------------------------------------------------------------
/** Timed tasks first (by start), then by priority, then newest — for a day. */
export function sortDayTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const sa = a.startMin ?? Number.POSITIVE_INFINITY;
    const sb = b.startMin ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return b.createdAt - a.createdAt;
  });
}

/** Group a user's tasks by their dueDate (undated tasks are skipped). */
export function tasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const arr = map.get(t.dueDate) ?? [];
    arr.push(t);
    map.set(t.dueDate, arr);
  }
  for (const arr of map.values()) sortDayTasks(arr);
  return map;
}

// ---------------------------------------------------------------------------
// Subtask helpers.
// ---------------------------------------------------------------------------
export function subtaskProgress(task: Pick<Task, "subtasks">): {
  done: number;
  total: number;
} {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.done).length;
  return { done, total };
}

export function makeSubtask(title: string, durationMin: number | null = null): Subtask {
  return {
    // crypto.randomUUID is available in every browser this app targets.
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `st_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
    title,
    done: false,
    durationMin,
  };
}

// ---------------------------------------------------------------------------
// Day summary — powers the Today "at a glance" panel.
// ---------------------------------------------------------------------------
export interface DaySummary {
  total: number;
  open: number;
  done: number;
  highOpen: number;
  /** Minutes of time blocked by scheduled, not-done tasks. */
  blockedMin: number;
  /** Latest end time among scheduled, not-done tasks (minutes), or null. */
  finishMin: number | null;
}

export function summarizeDay(tasks: Task[]): DaySummary {
  let open = 0;
  let done = 0;
  let highOpen = 0;
  let blockedMin = 0;
  let finishMin: number | null = null;
  for (const t of tasks) {
    if (t.status === "done") {
      done += 1;
      continue;
    }
    open += 1;
    if (t.priority === "high") highOpen += 1;
    const dur = taskDurationMin(t);
    if (dur) blockedMin += dur;
    if (t.endMin != null) finishMin = Math.max(finishMin ?? 0, t.endMin);
  }
  return { total: tasks.length, open, done, highOpen, blockedMin, finishMin };
}

/** "6:30 PM" for the estimated finish, or null. */
export function finishLabel(summary: DaySummary): string | null {
  return summary.finishMin != null ? minToLabel(summary.finishMin) : null;
}

// ---------------------------------------------------------------------------
// Recurrence — repeating tasks that materialize real occurrences.
// ---------------------------------------------------------------------------
export const RECURRENCE_FREQS: TaskRecurrenceFreq[] = ["daily", "weekly", "monthly"];
export const RECURRENCE_LABEL: Record<TaskRecurrenceFreq, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** Weekday chips, Monday-first, mapped to JS getDay() numbers. */
export const WEEKDAY_CHIPS: { n: number; label: string }[] = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Human summary of a recurrence rule, e.g. "Weekly on Mon, Wed". */
export function describeRecurrence(rec: TaskRecurrence): string {
  switch (rec.frequency) {
    case "daily":
      return "Every day";
    case "weekly": {
      if (rec.weekdays.length === 0) return "Weekly";
      const labels = WEEKDAY_CHIPS.filter((c) => rec.weekdays.includes(c.n)).map(
        (c) => c.label
      );
      return `Weekly on ${labels.join(", ")}`;
    }
    case "monthly":
      return rec.dayOfMonth != null
        ? `Monthly on the ${ordinal(rec.dayOfMonth)}`
        : "Monthly";
  }
}

/** Does a recurrence produce an occurrence on `key` (anchored at `anchorKey`)? */
function recurrenceMatches(
  rec: TaskRecurrence,
  anchorKey: string,
  key: string
): boolean {
  if (key < anchorKey) return false;
  if (rec.endDate && key > rec.endDate) return false;
  const d = new Date(key + "T00:00:00");
  switch (rec.frequency) {
    case "daily":
      return true;
    case "weekly": {
      if (rec.weekdays.length === 0)
        return d.getDay() === new Date(anchorKey + "T00:00:00").getDay();
      return rec.weekdays.includes(d.getDay());
    }
    case "monthly": {
      const dom = rec.dayOfMonth ?? new Date(anchorKey + "T00:00:00").getDate();
      const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(dom, lastOfMonth);
    }
  }
}

/**
 * Compute the occurrences that should exist but don't yet, for every recurring
 * "head" task, within [fromKey, horizonKey]. Bounded by `cap` total to keep a
 * page load cheap. Occurrences are de-duplicated against existing tasks in the
 * same series (matched by seriesId).
 */
export function planRecurringOccurrences(
  tasks: Task[],
  fromKey: string,
  horizonKey: string,
  cap = 150
): { head: Task; dueDate: string }[] {
  const out: { head: Task; dueDate: string }[] = [];
  const heads = tasks.filter((t) => t.recurrence && t.dueDate);
  for (const head of heads) {
    if (out.length >= cap) break;
    const seriesId = head.seriesId ?? head.id;
    const anchor = head.dueDate as string;
    const existing = new Set(
      tasks
        .filter((t) => (t.seriesId ?? t.id) === seriesId && t.dueDate)
        .map((t) => t.dueDate as string)
    );
    const start = anchor > fromKey ? anchor : fromKey;
    let key = start;
    // Hard iteration bound in case of bad data.
    for (let i = 0; i < 400 && key <= horizonKey; i++) {
      if (out.length >= cap) break;
      if (recurrenceMatches(head.recurrence as TaskRecurrence, anchor, key) && !existing.has(key)) {
        out.push({ head, dueDate: key });
      }
      key = addDays(key, 1);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Smart auto-scheduling — pack unscheduled tasks into free slots.
// ---------------------------------------------------------------------------
export interface SchedulePlacement {
  taskId: string;
  dueDate: string;
  startMin: number;
  endMin: number;
}

export interface AutoScheduleOpts {
  fromKey: string;
  days?: number;
  workStart?: number; // minutes since midnight
  workEnd?: number;
}

/** Earliest free start >= workStart that fits `dur` without overlapping `occ`. */
function firstFreeStart(
  occ: [number, number][],
  dur: number,
  workStart: number,
  workEnd: number
): number | null {
  const sorted = [...occ].sort((a, b) => a[0] - b[0]);
  let cursor = workStart;
  for (const [s, e] of sorted) {
    if (e <= cursor) continue;
    if (cursor + dur <= s) return cursor;
    cursor = Math.max(cursor, e);
  }
  return cursor + dur <= workEnd ? cursor : null;
}

/**
 * Place backlog tasks (highest priority first) into the earliest free work-hour
 * slots across the coming days, avoiding overlaps with already-scheduled tasks.
 * Pure — returns placements; the caller persists them.
 */
export function autoSchedule(
  backlog: Task[],
  scheduled: Task[],
  opts: AutoScheduleOpts
): SchedulePlacement[] {
  const days = opts.days ?? 7;
  const workStart = opts.workStart ?? 9 * 60;
  const workEnd = opts.workEnd ?? 18 * 60;

  const occ = new Map<string, [number, number][]>();
  for (const t of scheduled) {
    if (!t.dueDate || t.startMin == null || t.endMin == null) continue;
    const arr = occ.get(t.dueDate) ?? [];
    arr.push([t.startMin, t.endMin]);
    occ.set(t.dueDate, arr);
  }

  const dayKeys = Array.from({ length: days }, (_, i) => addDays(opts.fromKey, i));
  const queue = [...backlog].sort((a, b) => {
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return a.createdAt - b.createdAt;
  });

  const placements: SchedulePlacement[] = [];
  for (const task of queue) {
    const dur = taskDurationMin(task) ?? 60;
    for (const day of dayKeys) {
      const arr = occ.get(day) ?? [];
      const start = firstFreeStart(arr, dur, workStart, workEnd);
      if (start != null) {
        const end = start + dur;
        arr.push([start, end]);
        occ.set(day, arr);
        placements.push({ taskId: task.id, dueDate: day, startMin: start, endMin: end });
        break;
      }
    }
  }
  return placements;
}

// ---------------------------------------------------------------------------
// Reminders — in-app "starting soon" surfacing (push rides the cron later).
// ---------------------------------------------------------------------------
export const REMINDER_OPTIONS: { min: number; label: string }[] = [
  { min: 0, label: "At start" },
  { min: 5, label: "5 min before" },
  { min: 10, label: "10 min before" },
  { min: 15, label: "15 min before" },
  { min: 30, label: "30 min before" },
  { min: 60, label: "1 hour before" },
  { min: 1440, label: "1 day before" },
];

export function reminderLabel(min: number): string {
  return REMINDER_OPTIONS.find((r) => r.min === min)?.label ?? `${min} min before`;
}

/**
 * Today's tasks that are about to start, within their own reminder lead time.
 * Returns them soonest-first with minutes remaining, for a quiet in-app banner.
 */
export function upcomingReminders(
  tasks: Task[],
  todayKey: string,
  nowMin: number
): { task: Task; minutesUntil: number }[] {
  const out: { task: Task; minutesUntil: number }[] = [];
  for (const t of tasks) {
    if (t.status === "done") continue;
    if (t.dueDate !== todayKey || t.startMin == null) continue;
    if (t.reminders.length === 0) continue;
    const minutesUntil = t.startMin - nowMin;
    if (minutesUntil < 0) continue;
    const maxLead = Math.max(...t.reminders);
    if (minutesUntil <= maxLead) out.push({ task: t, minutesUntil });
  }
  return out.sort((a, b) => a.minutesUntil - b.minutesUntil);
}
