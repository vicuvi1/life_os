import type { SleepLog } from "@/lib/types";
import { addDays } from "@/lib/habits";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---------------------------------------------------------------------------
// Clock-time helpers ("HH:mm")
// ---------------------------------------------------------------------------
/** "HH:mm" → minutes since midnight, or null if unparseable. */
export function parseHM(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Hours between bedtime and wake time, wrapping past midnight. Null if either is missing. */
export function durationHours(bedtime: string | null, wakeTime: string | null): number | null {
  const b = parseHM(bedtime);
  const w = parseHM(wakeTime);
  if (b == null || w == null) return null;
  let mins = w - b;
  if (mins <= 0) mins += 24 * 60; // slept past midnight
  return Math.round((mins / 60) * 100) / 100;
}

/** Total time in bed (bedtime → wake); falls back to the logged duration when no times. */
export function timeInBedHours(log: Pick<SleepLog, "bedtime" | "wakeTime" | "hours">): number {
  return durationHours(log.bedtime, log.wakeTime) ?? log.hours;
}

// ---------------------------------------------------------------------------
// Sleep score (heuristic 0-100: 50% duration vs goal, 30% quality, 20% efficiency)
// ---------------------------------------------------------------------------
export function sleepScore(
  log: Pick<SleepLog, "hours" | "quality" | "bedtime" | "wakeTime" | "awakeMinutes">,
  target = 8
): number {
  const durationScore = clamp01(log.hours / target);
  const qualityScore = clamp01((log.quality || 0) / 10);
  const tib = timeInBedHours(log);
  const efficiencyScore = tib > 0 ? clamp01(log.hours / tib) : 1;
  return Math.round(100 * (0.5 * durationScore + 0.3 * qualityScore + 0.2 * efficiencyScore));
}

/** Label + colour for a sleep score. */
export function scoreMeta(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "#10b981" };
  if (score >= 70) return { label: "Good", color: "#84cc16" };
  if (score >= 50) return { label: "Fair", color: "#f59e0b" };
  return { label: "Poor", color: "#f43f5e" };
}

/**
 * Consecutive nights (ending today or yesterday) that met the sleep goal. Naps
 * are ignored. Returns 0 if neither last night nor the night before hit the goal.
 */
export function sleepGoalStreak(
  logs: Pick<SleepLog, "date" | "hours" | "kind">[],
  target: number,
  today: string
): number {
  const met = new Set(
    logs.filter((l) => l.kind !== "nap" && l.hours >= target).map((l) => l.date)
  );
  let cursor = met.has(today) ? today : addDays(today, -1);
  if (!met.has(cursor)) return 0;
  let streak = 0;
  while (met.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

/**
 * Rating for hours slept, relative to the user's sleep goal (default 8h,
 * giving the classic 7–9h "Good" band).
 */
export function hoursRating(
  hours: number,
  target = 8
): {
  label: string;
  variant: BadgeVariant;
} {
  if (hours >= target - 1 && hours <= target + 1)
    return { label: "Good", variant: "success" };
  if (hours >= target - 2 && hours < target - 1)
    return { label: "Okay", variant: "warning" };
  if (hours > target + 1) return { label: "Long", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

/** Rating for subjective sleep quality (1-10). */
export function qualityRating(q: number): {
  label: string;
  variant: BadgeVariant;
} {
  if (q >= 8) return { label: "Excellent", variant: "success" };
  if (q >= 6) return { label: "Good", variant: "success" };
  if (q >= 4) return { label: "Low", variant: "warning" };
  return { label: "Poor", variant: "destructive" };
}

/** Human-friendly hours, e.g. 7.5 → "7h 30m", 7 → "7h". */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Average hours across logs (0 if none). */
export function averageHours(logs: { hours: number }[]): number {
  if (logs.length === 0) return 0;
  return logs.reduce((s, l) => s + l.hours, 0) / logs.length;
}

/**
 * Smart default for a quick sleep log: the most frequent hours/quality value
 * logged in the last 14 days (simple frequency lookup, not ML). Falls back to
 * a sensible default (7h, quality 7) when there's no recent history.
 */
export function smartDefaultSleep(
  logs: SleepLog[],
  cutoffDateInclusive: string
): { hours: number; quality: number } {
  const recent = logs.filter((l) => l.date >= cutoffDateInclusive);
  if (recent.length === 0) return { hours: 7, quality: 7 };

  const mode = <T extends string | number>(values: T[]): T => {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = values[0];
    let bestCount = 0;
    for (const [v, c] of Array.from(counts.entries())) {
      if (c > bestCount) {
        bestCount = c;
        best = v;
      }
    }
    return best;
  };

  return {
    hours: mode(recent.map((l) => l.hours)),
    quality: mode(recent.map((l) => l.quality)),
  };
}
