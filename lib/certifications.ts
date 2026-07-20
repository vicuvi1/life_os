// Certification helpers.
//
// A "certification" is just a Goal tagged with category "certification" — no new
// collection or data-entry surface. Everything the Career sidebar shows
// (progress, the "14/50 modules" count, the exam date + days left, and an
// on-track/behind verdict) is DERIVED from existing Goal fields, in keeping with
// the app's smart-default / auto-calc philosophy: you fill in a goal once and the
// certification view stays current on its own.

import type { Goal } from "@/lib/types";
import { daysUntil } from "@/lib/labels";

/** A goal is a certification when it's tagged with the "certification" category. */
export function isCertificationGoal(goal: Goal): boolean {
  return goal.category === "certification";
}

export type CertStatusKey =
  | "done"
  | "on_track"
  | "behind"
  | "overdue"
  | "in_progress";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

export interface CertStatus {
  key: CertStatusKey;
  label: string;
  variant: BadgeVariant;
}

/**
 * How far ahead/behind the pace we tolerate before flagging "Behind".
 * With a deadline set, expected progress grows linearly from the day the goal
 * was created to its exam date; you're "On track" as long as you're within this
 * many points of that pace.
 */
const ON_TRACK_TOLERANCE = 10;

/**
 * Fraction of the run (created → deadline) that has elapsed, expressed as an
 * expected-progress percentage (0–100). null when it can't be computed (no
 * deadline, no createdAt, or a deadline on/before the created date).
 */
export function expectedProgress(goal: Goal): number | null {
  if (!goal.deadline || !goal.createdAt) return null;
  const start = goal.createdAt;
  const end = new Date(goal.deadline + "T00:00:00").getTime();
  if (!Number.isFinite(end) || end <= start) return null;
  const frac = (Date.now() - start) / (end - start);
  return Math.max(0, Math.min(100, frac * 100));
}

/** Derive a certification's status from its progress, deadline, and pace. */
export function certStatus(goal: Goal): CertStatus {
  const progress = goal.progress ?? 0;

  if (goal.status === "completed" || progress >= 100) {
    return { key: "done", label: "Done", variant: "success" };
  }

  const days = daysUntil(goal.deadline);
  if (days === null) {
    // No exam date — we can't judge pace, so just show it's underway.
    return { key: "in_progress", label: "In progress", variant: "secondary" };
  }
  if (days < 0) {
    return { key: "overdue", label: "Overdue", variant: "destructive" };
  }

  const expected = expectedProgress(goal);
  if (expected === null || progress + ON_TRACK_TOLERANCE >= expected) {
    return { key: "on_track", label: "On track", variant: "success" };
  }
  return { key: "behind", label: "Behind", variant: "warning" };
}

/**
 * "14/50 modules" for count-type goals, else null. The unit (e.g. "modules")
 * comes straight from the goal.
 */
export function certCountLabel(goal: Goal): string | null {
  if (goal.progressType !== "count" || goal.targetValue == null) return null;
  const current = goal.currentValue ?? 0;
  const unit = goal.unit ? ` ${goal.unit}` : "";
  return `${current}/${goal.targetValue}${unit}`;
}

export interface CertExam {
  /** Short calendar label, e.g. "Oct 15". */
  date: string;
  /** Days until the exam (negative if past). */
  days: number;
}

/** Exam date + days-left, derived from the goal's deadline. null if none set. */
export function certExam(goal: Goal): CertExam | null {
  if (!goal.deadline) return null;
  const days = daysUntil(goal.deadline);
  if (days === null) return null;
  const d = new Date(goal.deadline + "T00:00:00");
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return { date, days };
}

/**
 * Order certifications for the sidebar: nearest exam first (undated sink to the
 * bottom), then higher progress. Pure — returns a new array.
 */
export function sortCertifications(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const da = daysUntil(a.deadline);
    const db = daysUntil(b.deadline);
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    return (b.progress ?? 0) - (a.progress ?? 0);
  });
}
