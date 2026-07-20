// Time Audit & focus analytics — pure functions over Session data.
// "Time spent" = sessions marked done (planned/skipped don't count as spent).

import type { Session, SessionCategory } from "@/lib/types";
import { startOfWeekKey } from "@/lib/dates";
import { addDays } from "@/lib/habits";

export interface TimeBucket {
  key: string;
  label: string;
  startMin: number; // inclusive
  endMin: number; // exclusive
}

// Buckets across the day. Night wraps midnight and is handled specially.
export const TIME_BUCKETS: TimeBucket[] = [
  { key: "early", label: "Early (5–9am)", startMin: 5 * 60, endMin: 9 * 60 },
  { key: "lateMorning", label: "Late morning (9–12)", startMin: 9 * 60, endMin: 12 * 60 },
  { key: "afternoon", label: "Afternoon (12–5pm)", startMin: 12 * 60, endMin: 17 * 60 },
  { key: "evening", label: "Evening (5–9pm)", startMin: 17 * 60, endMin: 21 * 60 },
  { key: "night", label: "Night (9pm–5am)", startMin: 21 * 60, endMin: 29 * 60 },
];

function bucketFor(startMin: number): TimeBucket {
  if (startMin >= 21 * 60 || startMin < 5 * 60) {
    return TIME_BUCKETS[TIME_BUCKETS.length - 1]; // night
  }
  for (const b of TIME_BUCKETS) {
    if (startMin >= b.startMin && startMin < b.endMin) return b;
  }
  return TIME_BUCKETS[TIME_BUCKETS.length - 1];
}

function isDone(s: Session): boolean {
  return s.status === "done";
}

function inRange(s: Session, fromDate: string, toDate: string): boolean {
  return s.date >= fromDate && s.date <= toDate;
}

function minutes(s: Session): number {
  return Math.max(0, s.endMin - s.startMin);
}

export interface CategoryTotal {
  category: SessionCategory;
  minutes: number;
}

/** Total done-minutes per category within a date range, sorted desc. */
export function categoryTotals(
  sessions: Session[],
  fromDate: string,
  toDate: string
): CategoryTotal[] {
  const map = new Map<SessionCategory, number>();
  for (const s of sessions) {
    if (!isDone(s) || !inRange(s, fromDate, toDate)) continue;
    map.set(s.category, (map.get(s.category) ?? 0) + minutes(s));
  }
  return Array.from(map.entries())
    .map(([category, mins]) => ({ category, minutes: mins }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Total done-minutes within a date range. */
export function totalDoneMinutes(
  sessions: Session[],
  fromDate: string,
  toDate: string
): number {
  return sessions
    .filter((s) => isDone(s) && inRange(s, fromDate, toDate))
    .reduce((sum, s) => sum + minutes(s), 0);
}

export interface FocusBucket {
  key: string;
  label: string;
  avgQuality: number | null;
  count: number;
  minutes: number;
}

/**
 * Group completed, rated sessions into time-of-day buckets and compute average
 * quality per bucket — reveals when the user actually performs best.
 */
export function focusByTimeOfDay(
  sessions: Session[],
  fromDate: string,
  toDate: string
): FocusBucket[] {
  const acc = new Map<string, { qualitySum: number; count: number; minutes: number }>();
  for (const b of TIME_BUCKETS) acc.set(b.key, { qualitySum: 0, count: 0, minutes: 0 });

  for (const s of sessions) {
    if (!isDone(s) || s.quality == null || !inRange(s, fromDate, toDate)) continue;
    const b = bucketFor(s.startMin);
    const cur = acc.get(b.key)!;
    cur.qualitySum += s.quality;
    cur.count += 1;
    cur.minutes += minutes(s);
  }

  return TIME_BUCKETS.map((b) => {
    const cur = acc.get(b.key)!;
    return {
      key: b.key,
      label: b.label,
      avgQuality: cur.count > 0 ? cur.qualitySum / cur.count : null,
      count: cur.count,
      minutes: cur.minutes,
    };
  });
}

/** The bucket with the highest average quality that has enough sessions. */
export function bestFocusBucket(
  buckets: FocusBucket[],
  minCount = 2
): FocusBucket | null {
  const eligible = buckets.filter(
    (b) => b.avgQuality != null && b.count >= minCount
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, b) =>
    (b.avgQuality as number) > (best.avgQuality as number) ? b : best
  );
}

export interface WeeklyTrend {
  thisWeek: number; // minutes
  lastWeek: number; // minutes
  deltaPct: number | null; // % change vs last week, null if last week was 0
}

/** Done-minutes this ISO week vs last week (relative to `todayKey`). */
export function weeklyStudyTrend(
  sessions: Session[],
  todayKey: string
): WeeklyTrend {
  const thisStart = startOfWeekKey(todayKey);
  const thisEnd = addDays(thisStart, 6);
  const lastStart = addDays(thisStart, -7);
  const lastEnd = addDays(thisStart, -1);

  const thisWeek = totalDoneMinutes(sessions, thisStart, thisEnd);
  const lastWeek = totalDoneMinutes(sessions, lastStart, lastEnd);
  const deltaPct =
    lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  return { thisWeek, lastWeek, deltaPct };
}
