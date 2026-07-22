// Goal measurement engine — flexible, per-goal progress computation.
// Kept UI-free so the form, list, detail and dashboard all agree on the numbers.

import { CATEGORY_LABEL } from "@/lib/labels";
import type {
  Goal,
  GoalCompositeComponent,
  GoalLogEntry,
  GoalMeasurement,
  GoalMilestone,
  GoalMilestoneStep,
  GoalSubtask,
  MilestoneMeasurement,
  Task,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Measurement type metadata (drives the picker).
// ---------------------------------------------------------------------------
export const MEASUREMENTS: { key: GoalMeasurement; label: string; hint: string }[] = [
  { key: "percentage", label: "Percentage", hint: "You set the % directly (0–100)." },
  { key: "count", label: "Count toward target", hint: "e.g. 47 / 300 applications, 1200 / 2000 saved." },
  { key: "milestones", label: "Milestone checklist", hint: "Weighted completion of this goal's milestones." },
  { key: "tasks", label: "From tasks (auto)", hint: "Auto from completed linked tasks & projects." },
  { key: "linked", label: "Linked time", hint: "Hours logged in Sessions tagged to this goal." },
  { key: "composite", label: "Key Results (OKR)", hint: "An objective measured by 2–4 weighted key results." },
];

export const MEASUREMENT_LABEL = MEASUREMENTS.reduce(
  (acc, m) => ({ ...acc, [m.key]: m.label }),
  {} as Record<GoalMeasurement, string>
);

/** Common starting points for the category tag (free text is still allowed). */
export const CATEGORY_SUGGESTIONS = [
  "Education",
  "Career",
  "Certification",
  "Health",
  "Fitness",
  "Finance",
  "Personal",
];

/** Accent palette + a small icon set for visual distinction on the list. */
export const GOAL_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];
export const GOAL_ICONS = ["🎯", "📚", "💼", "💪", "💰", "🏆", "🧠", "🌍", "🚀", "❤️", "🎓", "🧗"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
const pct = (cur: number, tar: number) =>
  tar > 0 ? clamp(Math.round((cur / tar) * 100), 0, 100) : 0;
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// ---------------------------------------------------------------------------
// Milestone + composite math.
// ---------------------------------------------------------------------------
/** A single milestone's completion as a 0..1 fraction. */
export function milestoneFraction(m: GoalMilestone): number {
  if (m.done) return 1;
  if (m.measurement === "count" && m.targetValue && m.targetValue > 0)
    return clamp((m.currentValue ?? 0) / m.targetValue, 0, 1);
  if (m.measurement === "steps" && m.steps.length > 0)
    return m.steps.filter((s) => s.done).length / m.steps.length;
  return 0;
}

/** Weighted milestone completion as a 0-100 percentage. */
export function milestonesProgress(ms: GoalMilestone[]): number {
  if (ms.length === 0) return 0;
  const w = (m: GoalMilestone) => (m.weight > 0 ? m.weight : 1);
  const totalW = ms.reduce((s, m) => s + w(m), 0);
  if (totalW <= 0) return 0;
  const acc = ms.reduce((s, m) => s + w(m) * milestoneFraction(m), 0);
  return clamp(Math.round((acc / totalW) * 100), 0, 100);
}

/** Weighted composite progress as a 0-100 percentage. */
export function compositeProgress(cs: GoalCompositeComponent[]): number {
  if (cs.length === 0) return 0;
  const w = (c: GoalCompositeComponent) => (c.weight > 0 ? c.weight : 1);
  const totalW = cs.reduce((s, c) => s + w(c), 0);
  if (totalW <= 0) return 0;
  const acc = cs.reduce(
    (s, c) => s + w(c) * (c.target > 0 ? clamp(c.current / c.target, 0, 1) : 0),
    0
  );
  return clamp(Math.round((acc / totalW) * 100), 0, 100);
}

// ---------------------------------------------------------------------------
// Goal progress.
// ---------------------------------------------------------------------------
export interface GoalProgressCtx {
  /** For "tasks" measurement. */
  taskDone?: number;
  taskTotal?: number;
  /** For "linked" measurement — total logged Session minutes for this goal. */
  linkedMinutes?: number;
}

/** The authoritative 0-100 progress for a goal given its measurement type. */
export function computeGoalProgress(goal: Goal, ctx: GoalProgressCtx = {}): number {
  switch (goal.measurement) {
    case "percentage":
      return clamp(Math.round(goal.progress ?? 0), 0, 100);
    case "count":
      return pct(goal.currentValue ?? 0, goal.targetValue ?? 0);
    case "milestones":
      return milestonesProgress(goal.milestones);
    case "composite":
      return compositeProgress(goal.composite);
    case "tasks": {
      const subTotal = goal.subtasks.length;
      const subDone = goal.subtasks.filter((s) => s.done).length;
      const total = (ctx.taskTotal ?? 0) + subTotal;
      const done = (ctx.taskDone ?? 0) + subDone;
      return total > 0
        ? clamp(Math.round((done / total) * 100), 0, 100)
        : goal.progress ?? 0;
    }
    case "linked":
      return pct((ctx.linkedMinutes ?? 0) / 60, goal.targetValue ?? 0);
    default:
      return goal.progress ?? 0;
  }
}

/** A short human detail under the bar, e.g. "47 / 300 applications". */
export function goalProgressDetail(goal: Goal, ctx: GoalProgressCtx = {}): string | null {
  switch (goal.measurement) {
    case "count": {
      const u = goal.unit ? ` ${goal.unit}` : "";
      return `${fmt(goal.currentValue ?? 0)} / ${fmt(goal.targetValue ?? 0)}${u}`;
    }
    case "milestones": {
      const done = goal.milestones.filter((m) => m.done).length;
      return `${done} / ${goal.milestones.length} milestones`;
    }
    case "linked": {
      const curH = (ctx.linkedMinutes ?? 0) / 60;
      return `${fmt(Math.round(curH * 10) / 10)} / ${fmt(goal.targetValue ?? 0)} h`;
    }
    case "tasks": {
      const subTotal = goal.subtasks.length;
      const subDone = goal.subtasks.filter((s) => s.done).length;
      const taskTotal = ctx.taskTotal ?? 0;
      const total = taskTotal + subTotal;
      if (total === 0) return null;
      const done = (ctx.taskDone ?? 0) + subDone;
      return `${done} / ${total} ${taskTotal > 0 ? "items" : "subtasks"}`;
    }
    case "composite":
      return goal.composite.length > 0
        ? `${goal.composite.length} key result${goal.composite.length > 1 ? "s" : ""}`
        : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Deadline (fixes the "NaNd left" bug — never computes against a missing date).
// ---------------------------------------------------------------------------
export type DeadlineTone = "none" | "overdue" | "soon" | "far";
export interface DeadlineInfo {
  label: string;
  tone: DeadlineTone;
}

export function goalDeadline(goal: Pick<Goal, "deadline">): DeadlineInfo {
  const target = goal.deadline;
  if (!target) return { label: "No deadline set", tone: "none" };
  const d = new Date(target + "T00:00:00");
  if (Number.isNaN(d.getTime())) return { label: "No deadline set", tone: "none" };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  return { label: `${days}d left`, tone: days <= 14 ? "soon" : "far" };
}

// ---------------------------------------------------------------------------
// Category label (built-in labels win; otherwise the raw tag, capitalized).
// ---------------------------------------------------------------------------
export function categoryLabel(cat: string | null | undefined): string | null {
  if (!cat) return null;
  return (
    (CATEGORY_LABEL as Record<string, string>)[cat] ??
    cat.charAt(0).toUpperCase() + cat.slice(1)
  );
}

// ---------------------------------------------------------------------------
// Factories (used by the forms).
// ---------------------------------------------------------------------------
function uid(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

export function makeCompositeComponent(): GoalCompositeComponent {
  return { id: uid("c"), label: "", weight: 1, current: 0, target: 100, unit: null };
}

export function makeMilestone(order: number): GoalMilestone {
  return {
    id: uid("m"),
    title: "",
    measurement: "check",
    currentValue: null,
    targetValue: null,
    unit: null,
    weight: 1,
    order,
    dueDate: null,
    completedDate: null,
    done: false,
    linkedTaskIds: [],
    linkedProjectIds: [],
    autoComplete: false,
    steps: [],
  };
}

export function makeMilestoneStep(title: string): GoalMilestoneStep {
  return { id: uid("s"), title, done: false };
}

export function makeSubtask(title: string): GoalSubtask {
  return { id: uid("st"), title, done: false };
}

export const MILESTONE_MEASUREMENTS: { key: MilestoneMeasurement; label: string }[] = [
  { key: "check", label: "Checkbox" },
  { key: "count", label: "Count toward target" },
  { key: "steps", label: "Sub-steps checklist" },
];

/** Milestones in display order. */
export function sortMilestones(ms: GoalMilestone[]): GoalMilestone[] {
  return [...ms].sort((a, b) => a.order - b.order);
}

/** Short detail for a milestone's own progress, e.g. "2 / 3 exams". */
export function milestoneDetail(m: GoalMilestone): string | null {
  if (m.measurement === "count" && m.targetValue)
    return `${m.currentValue ?? 0} / ${m.targetValue}${m.unit ? ` ${m.unit}` : ""}`;
  if (m.measurement === "steps" && m.steps.length)
    return `${m.steps.filter((s) => s.done).length} / ${m.steps.length} steps`;
  return null;
}

/**
 * Auto-complete milestones whose linked tasks are all done (only those flagged
 * `autoComplete`). Returns the (possibly) updated list + whether anything changed.
 */
export function autoAdvanceMilestones(
  milestones: GoalMilestone[],
  doneTaskIds: Set<string>,
  today: string
): { milestones: GoalMilestone[]; changed: boolean } {
  let changed = false;
  const next = milestones.map((m) => {
    if (!m.autoComplete || m.done || m.linkedTaskIds.length === 0) return m;
    if (m.linkedTaskIds.every((id) => doneTaskIds.has(id))) {
      changed = true;
      return { ...m, done: true, completedDate: m.completedDate ?? today };
    }
    return m;
  });
  return { milestones: next, changed };
}

/** A non-auto milestone whose linked tasks are all done → prompt to complete. */
export function milestoneReadyToComplete(
  m: GoalMilestone,
  doneTaskIds: Set<string>
): boolean {
  return (
    !m.done &&
    !m.autoComplete &&
    m.linkedTaskIds.length > 0 &&
    m.linkedTaskIds.every((id) => doneTaskIds.has(id))
  );
}

// ---------------------------------------------------------------------------
// Milestone 3 — progress history, trend & realistic pacing.
// ---------------------------------------------------------------------------
function keyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function shiftKey(key: string, days: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + days);
  return keyOf(d);
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const dbb = new Date(b + "T00:00:00").getTime();
  if (Number.isNaN(da) || Number.isNaN(dbb)) return 0;
  return Math.round((dbb - da) / 86_400_000);
}
const byDate = (a: GoalLogEntry, b: GoalLogEntry) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

/** Upsert a daily snapshot (one entry per date), keeping the log bounded. */
export function upsertGoalLog(
  log: GoalLogEntry[],
  date: string,
  value: number,
  cap = 400
): GoalLogEntry[] {
  const next = [...log.filter((e) => e.date !== date), { date, value }].sort(byDate);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Days from `today` to the target date (negative = past); null if no deadline. */
export function daysToDeadline(
  goal: Pick<Goal, "deadline">,
  today: string
): number | null {
  if (!goal.deadline) return null;
  const d = new Date(goal.deadline + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return daysBetween(today, goal.deadline);
}

export interface TrendInfo {
  direction: "up" | "down" | "flat";
  delta: number; // percentage points vs the recent reference point
}

/** Recent trend (current vs the value ~1 week ago). Null until ≥2 data points. */
export function goalTrend(goal: Pick<Goal, "progressLog">): TrendInfo | null {
  const log = [...goal.progressLog].sort(byDate);
  if (log.length < 2) return null;
  const last = log[log.length - 1];
  const refKey = shiftKey(last.date, -7);
  // Latest point on/before the reference day, else the earliest available.
  const ref = [...log].reverse().find((e) => e.date <= refKey) ?? log[0];
  const delta = Math.round(last.value - ref.value);
  return { direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat", delta };
}

export type PaceLabel =
  | "On track"
  | "Ahead of schedule"
  | "Behind schedule"
  | "No deadline set";
export interface PaceInfo {
  label: PaceLabel;
  tone: "good" | "warn" | "bad" | "none";
  detail: string | null;
}

/**
 * Plain-language pace from simple linear extrapolation (velocity over the last
 * ~4 weeks vs. the target date). Deliberately arithmetic, clearly an estimate —
 * not a forecast model. Returns null when there isn't enough history to judge.
 */
export function goalPace(
  goal: Pick<Goal, "deadline" | "progressLog">,
  today: string
): PaceInfo | null {
  if (!goal.deadline) return { label: "No deadline set", tone: "none", detail: null };
  const log = [...goal.progressLog].sort(byDate);
  if (log.length < 2) return null; // not enough history — gate the estimate

  const last = log[log.length - 1];
  const current = last.value;
  if (current >= 100) return { label: "On track", tone: "good", detail: "Complete 🎉" };

  const daysLeft = daysToDeadline(goal, today);
  if (daysLeft == null) return null;
  if (daysLeft <= 0)
    return { label: "Behind schedule", tone: "bad", detail: "Past the target date" };

  // Velocity across the last up-to-28 days of history.
  const windowStart = shiftKey(last.date, -28);
  const win = log.filter((e) => e.date >= windowStart);
  const first = win[0];
  const span = Math.max(1, daysBetween(first.date, last.date));
  const velocity = (last.value - first.value) / span; // %/day
  const remaining = 100 - current;
  const required = remaining / daysLeft;

  if (velocity <= 0)
    return { label: "Behind schedule", tone: "bad", detail: "No recent progress (estimate)" };

  const projected = Math.min(100, Math.round(current + velocity * daysLeft));
  const ratio = velocity / required;
  const label: PaceLabel =
    ratio >= 1.15 ? "Ahead of schedule" : ratio >= 0.9 ? "On track" : "Behind schedule";
  return {
    label,
    tone: label === "Behind schedule" ? "warn" : "good",
    detail: `≈ ${projected}% by the deadline at this pace (estimate)`,
  };
}

/** An active goal with no progress in `staleDays` (default 14) needs attention. */
export function goalStale(
  goal: Pick<Goal, "status" | "progressLog" | "staleDays" | "createdAt">,
  today: string,
  defaultDays = 14
): boolean {
  if (goal.status !== "active") return false;
  const days = goal.staleDays ?? defaultDays;
  const log = [...goal.progressLog].sort(byDate);
  // Reference = last progress entry, else the goal's creation date. This keeps a
  // brand-new goal (or one predating the progress log) from being flagged stale
  // the moment it exists — it only goes stale after `days` of real inactivity.
  const ref =
    log.length > 0
      ? log[log.length - 1].date
      : goal.createdAt
        ? keyOf(new Date(goal.createdAt))
        : today;
  return daysBetween(ref, today) >= days;
}

// ---------------------------------------------------------------------------
// Next action — the single most concrete thing to do for a goal. Powers the
// Focus section and the Today's Momentum strip: a goal you can't act on is a
// wish, so we always surface one clear, completable step.
// ---------------------------------------------------------------------------
export type NextAction =
  | { kind: "subtask"; goalId: string; subtaskId: string; title: string }
  | { kind: "task"; taskId: string; goalId: string; title: string; dueDate: string | null }
  | { kind: "step"; milestoneId: string; stepId: string; title: string }
  | { kind: "milestone"; milestoneId: string; title: string };

/**
 * The next action for a goal, preferring the most concrete unit available:
 *   1. the earliest open linked task (by due date, then sort order),
 *   2. else the first unchecked step inside the first open milestone,
 *   3. else the first open milestone itself.
 * Returns null when the goal has nothing broken out to act on yet.
 */
export function goalNextAction(goal: Goal, tasks: Task[]): NextAction | null {
  // Quick-checklist subtasks come first — they're the lightweight thing you
  // actively tick off, and this wires them into Today's Momentum.
  const sub = goal.subtasks.find((s) => !s.done);
  if (sub) return { kind: "subtask", goalId: goal.id, subtaskId: sub.id, title: sub.title };

  const open = tasks
    .filter((t) => t.goalId === goal.id && t.status !== "done")
    .sort((a, b) => {
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  if (open.length > 0) {
    const t = open[0];
    return { kind: "task", taskId: t.id, goalId: goal.id, title: t.title, dueDate: t.dueDate };
  }
  const ms = sortMilestones(goal.milestones);
  for (const m of ms) {
    if (m.done) continue;
    const step = m.steps.find((s) => !s.done);
    if (step) return { kind: "step", milestoneId: m.id, stepId: step.id, title: step.title };
  }
  const nextM = ms.find((m) => !m.done);
  if (nextM) return { kind: "milestone", milestoneId: nextM.id, title: nextM.title };
  return null;
}

/**
 * The still-open goals blocking this one (dependencies not yet completed).
 * A goal is "blocked" when this returns a non-empty list.
 */
export function goalBlockers(
  goal: Pick<Goal, "dependsOn">,
  byId: Map<string, Goal>
): Goal[] {
  return goal.dependsOn
    .map((id) => byId.get(id))
    .filter((g): g is Goal => !!g && g.status !== "completed");
}

// ---------------------------------------------------------------------------
// Momentum — "am I actually moving on this?" independent of any deadline.
// Blends recent velocity with recency of the last gain into one 0-100 score +
// a plain-language label, so a goal reads at a glance: Flying / Steady /
// Warming up / Stalled. Deliberately simple, explainable arithmetic.
// ---------------------------------------------------------------------------
export type MomentumLabel = "Flying" | "Steady" | "Warming up" | "Stalled" | "New";
export interface MomentumInfo {
  score: number; // 0-100
  label: MomentumLabel;
  tone: "good" | "ok" | "warn" | "none";
  velocityPerWeek: number; // %/week over the recent window (1 dp)
  daysSinceGain: number | null; // days since progress last increased
}

export function goalMomentum(
  goal: Pick<Goal, "progressLog">,
  today: string
): MomentumInfo {
  const log = [...goal.progressLog].sort(byDate);
  if (log.length < 2)
    return { score: 0, label: "New", tone: "none", velocityPerWeek: 0, daysSinceGain: null };

  const last = log[log.length - 1];

  // Most recent day where progress increased vs the entry before it.
  let lastGain: string | null = null;
  for (let i = 1; i < log.length; i++) {
    if (log[i].value > log[i - 1].value) lastGain = log[i].date;
  }
  const daysSinceGain = lastGain ? daysBetween(lastGain, today) : null;

  // Velocity across the last up-to-14 days of history.
  const windowStart = shiftKey(last.date, -14);
  const win = log.filter((e) => e.date >= windowStart);
  const first = win[0] ?? log[0];
  const span = Math.max(1, daysBetween(first.date, last.date));
  const velocityPerWeek = Math.round(((last.value - first.value) / span) * 7 * 10) / 10;

  if (last.value >= 100)
    return { score: 100, label: "Steady", tone: "good", velocityPerWeek, daysSinceGain };

  const vScore = clamp(Math.round(velocityPerWeek * 8), 0, 70);
  const recency = daysSinceGain == null ? 0 : clamp(30 - daysSinceGain * 3, 0, 30);
  const score = clamp(vScore + recency, 0, 100);
  const label: MomentumLabel =
    score >= 70 ? "Flying" : score >= 40 ? "Steady" : score >= 15 ? "Warming up" : "Stalled";
  const tone: MomentumInfo["tone"] =
    label === "Flying" || label === "Steady"
      ? "good"
      : label === "Warming up"
        ? "ok"
        : "warn";
  return { score, label, tone, velocityPerWeek, daysSinceGain };
}

/** Compact "Jul 14"-style label for a date key (for the trend chart axis). */
export function shortDate(key: string): string {
  const d = new Date(key + "T00:00:00");
  if (Number.isNaN(d.getTime())) return key;
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${M[d.getMonth()]} ${d.getDate()}`;
}
