// Task planner domain logic — the calendar/Notion-style Tasks experience.
// Kept framework-free so views stay thin. Scheduling reuses the Session
// vocabulary (minutes since midnight) and the helpers in lib/sessions.ts.

import type { Priority, Subtask, Task } from "@/lib/types";
import { minToLabel } from "@/lib/sessions";

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
