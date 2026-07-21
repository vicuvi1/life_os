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

/** Consecutive dates present in `set`, counting back from today (or yesterday). */
function streakCount(set: Set<string>, today: string): number {
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
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
    logs.filter((l) => l.kind !== "nap" && l.hours >= target && l.hours > 0).map((l) => l.date)
  );
  return streakCount(met, today);
}

// ---------------------------------------------------------------------------
// Time-of-day statistics (circular — so times wrapping midnight average right)
// ---------------------------------------------------------------------------
/** Bedtimes before noon are treated as after-midnight (e.g. 00:30 → 24:30). */
function normalizeBedtimeMin(min: number): number {
  return min < 12 * 60 ? min + 24 * 60 : min;
}

function circularMeanMin(mins: number[]): number | null {
  if (!mins.length) return null;
  let sx = 0;
  let sy = 0;
  for (const m of mins) {
    const a = (m / 1440) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  let mean = (Math.atan2(sy / mins.length, sx / mins.length) / (2 * Math.PI)) * 1440;
  if (mean < 0) mean += 1440;
  return Math.round(mean);
}

function circularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return d > 720 ? 1440 - d : d;
}

/** "HH:mm" from minutes since midnight. */
export function minutesToHM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Average bedtime as "HH:mm" (circular mean), or null when none logged. */
export function averageBedtime(logs: Pick<SleepLog, "bedtime" | "kind">[]): string | null {
  const mins = logs.filter((l) => l.kind !== "nap").map((l) => parseHM(l.bedtime)).filter((m): m is number => m != null);
  const mean = circularMeanMin(mins);
  return mean == null ? null : minutesToHM(mean);
}

/** Average wake-up as "HH:mm" (circular mean), or null when none logged. */
export function averageWake(logs: Pick<SleepLog, "wakeTime" | "kind">[]): string | null {
  const mins = logs.filter((l) => l.kind !== "nap").map((l) => parseHM(l.wakeTime)).filter((m): m is number => m != null);
  const mean = circularMeanMin(mins);
  return mean == null ? null : minutesToHM(mean);
}

/**
 * Sleep consistency 0-100 — how tightly bedtime and wake cluster around their
 * own averages (100 = identical every night). Null until ≥3 nights have times.
 */
export function sleepConsistency(logs: Pick<SleepLog, "bedtime" | "wakeTime" | "kind">[]): number | null {
  const nights = logs.filter((l) => l.kind !== "nap");
  const bed = nights.map((l) => parseHM(l.bedtime)).filter((m): m is number => m != null);
  const wake = nights.map((l) => parseHM(l.wakeTime)).filter((m): m is number => m != null);
  if (bed.length < 3 || wake.length < 3) return null;
  const mad = (vals: number[]) => {
    const mean = circularMeanMin(vals)!;
    return vals.reduce((s, v) => s + circularDiff(v, mean), 0) / vals.length;
  };
  const avgMad = (mad(bed) + mad(wake)) / 2; // minutes
  return Math.round(clamp01(1 - avgMad / 180) * 100); // 3h spread → 0
}

/** Best (longest) logged night. */
export function bestNight(logs: Pick<SleepLog, "date" | "hours" | "kind">[]): { date: string; hours: number } | null {
  const nights = logs.filter((l) => l.kind !== "nap" && l.hours > 0);
  if (!nights.length) return null;
  const b = nights.reduce((a, l) => (l.hours > a.hours ? l : a));
  return { date: b.date, hours: b.hours };
}

/** Worst (shortest) logged night. */
export function worstNight(logs: Pick<SleepLog, "date" | "hours" | "kind">[]): { date: string; hours: number } | null {
  const nights = logs.filter((l) => l.kind !== "nap" && l.hours > 0);
  if (!nights.length) return null;
  const w = nights.reduce((a, l) => (l.hours < a.hours ? l : a));
  return { date: w.date, hours: w.hours };
}

// ---------------------------------------------------------------------------
// Averages, debt, extra streaks
// ---------------------------------------------------------------------------
/** Average hours across the last `days` nights that were logged (0 if none). */
export function averageOverDays(
  logs: Pick<SleepLog, "date" | "hours" | "kind">[],
  today: string,
  days: number
): number {
  const cutoff = addDays(today, -(days - 1));
  const recent = logs.filter((l) => l.kind !== "nap" && l.hours > 0 && l.date >= cutoff);
  return averageHours(recent);
}

/**
 * Net sleep debt over the last `days` nights: sum of (hours − target). Negative
 * = debt (slept less than goal overall), positive = surplus.
 */
export function sleepDebt(
  logs: Pick<SleepLog, "date" | "hours" | "kind">[],
  target: number,
  today: string,
  days = 7
): number {
  const cutoff = addDays(today, -(days - 1));
  const recent = logs.filter((l) => l.kind !== "nap" && l.hours > 0 && l.date >= cutoff);
  return Math.round(recent.reduce((s, l) => s + (l.hours - target), 0) * 10) / 10;
}

/** Consecutive nights you were in bed by the target bedtime (± grace minutes). */
export function bedtimeStreak(
  logs: Pick<SleepLog, "date" | "bedtime" | "kind">[],
  targetBedtime: string | null,
  today: string,
  graceMin = 30
): number {
  const t = parseHM(targetBedtime);
  if (t == null) return 0;
  const limit = normalizeBedtimeMin(t) + graceMin;
  const ok = new Set(
    logs
      .filter((l) => l.kind !== "nap")
      .filter((l) => {
        const b = parseHM(l.bedtime);
        return b != null && normalizeBedtimeMin(b) <= limit;
      })
      .map((l) => l.date)
  );
  return streakCount(ok, today);
}

/** Consecutive mornings you woke by the target wake time (± grace minutes). */
export function wakeStreak(
  logs: Pick<SleepLog, "date" | "wakeTime" | "kind">[],
  targetWake: string | null,
  today: string,
  graceMin = 30
): number {
  const t = parseHM(targetWake);
  if (t == null) return 0;
  const ok = new Set(
    logs
      .filter((l) => l.kind !== "nap")
      .filter((l) => {
        const w = parseHM(l.wakeTime);
        return w != null && w <= t + graceMin;
      })
      .map((l) => l.date)
  );
  return streakCount(ok, today);
}

/** Consecutive nights with a consistent schedule (bedtime & wake within ± tol of your averages). */
export function consistencyStreak(
  logs: Pick<SleepLog, "date" | "bedtime" | "wakeTime" | "kind">[],
  today: string,
  tolMin = 45
): number {
  const nights = logs.filter((l) => l.kind !== "nap");
  const bedMean = circularMeanMin(nights.map((l) => parseHM(l.bedtime)).filter((m): m is number => m != null));
  const wakeMean = circularMeanMin(nights.map((l) => parseHM(l.wakeTime)).filter((m): m is number => m != null));
  if (bedMean == null || wakeMean == null) return 0;
  const ok = new Set(
    nights
      .filter((l) => {
        const b = parseHM(l.bedtime);
        const w = parseHM(l.wakeTime);
        return b != null && w != null && circularDiff(b, bedMean) <= tolMin && circularDiff(w, wakeMean) <= tolMin;
      })
      .map((l) => l.date)
  );
  return streakCount(ok, today);
}

/** Longest run of consecutive goal-met nights anywhere in history. */
export function longestGoalStreak(logs: Pick<SleepLog, "date" | "hours" | "kind">[], target: number): number {
  const met = logs.filter((l) => l.kind !== "nap" && l.hours >= target && l.hours > 0).map((l) => l.date).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of met) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Recovery, energy, recommendation
// ---------------------------------------------------------------------------
/** Recovery 0-100 for last night: sleep score minus a penalty for recent debt. */
export function recoveryScore(
  lastLog: Pick<SleepLog, "hours" | "quality" | "bedtime" | "wakeTime" | "awakeMinutes"> | null,
  netDebtHours: number,
  target = 8
): number {
  if (!lastLog) return 0;
  const base = sleepScore(lastLog, target);
  const debtPenalty = Math.min(25, Math.max(0, -netDebtHours) * 6);
  const surplusBonus = Math.min(6, Math.max(0, netDebtHours) * 2);
  return Math.round(clamp01((base - debtPenalty + surplusBonus) / 100) * 100);
}

/** Predicted energy % today from recovery, nudged by a goal streak. */
export function energyToday(recovery: number, goalStreak: number): number {
  return Math.round(clamp01((recovery + Math.min(8, goalStreak)) / 100) * 100);
}

/** Average recovery over the last `days` logged nights (each vs its trailing debt). */
export function averageRecovery(
  logs: SleepLog[],
  target: number,
  today: string,
  days = 7
): number | null {
  const cutoff = addDays(today, -(days - 1));
  const recent = logs.filter((l) => l.kind !== "nap" && l.hours > 0 && l.date >= cutoff);
  if (!recent.length) return null;
  const sum = recent.reduce((s, l) => s + recoveryScore(l, sleepDebt(logs, target, l.date, 7), target), 0);
  return Math.round(sum / recent.length);
}

/** One actionable sleep tip based on the recent picture. */
export function sleepRecommendation(ctx: {
  lastLog: SleepLog | null;
  netDebtHours: number;
  target: number;
  bedtimeTarget: string | null;
  goalStreak: number;
}): string {
  const { lastLog, netDebtHours, target, bedtimeTarget, goalStreak } = ctx;
  if (!lastLog) return "Log last night to get a personalised recommendation.";
  if (netDebtHours <= -2) {
    return `You're carrying ${Math.abs(netDebtHours)}h of sleep debt${bedtimeTarget ? ` — aim to be in bed by ${bedtimeTarget} tonight.` : " — try an earlier night."}`;
  }
  if (lastLog.quality <= 4) return "Last night's quality was low — cut screens an hour before bed and keep the room cool.";
  if (lastLog.hours < target - 1) return `You slept ${formatHours(lastLog.hours)} — under your ${target}h goal. An earlier bedtime tonight will help.`;
  if (goalStreak >= 5) return `${goalStreak} nights on goal — great consistency. Keep the same bedtime tonight.`;
  return "You're on track — hold your bedtime and wake time steady to build consistency.";
}

/** A few concrete tips for today, prioritised by what the data shows. */
export function sleepRecommendations(ctx: {
  lastLog: SleepLog | null;
  netDebtHours: number;
  target: number;
  bedtimeTarget: string | null;
  goalStreak: number;
}): string[] {
  const { lastLog, netDebtHours, target, bedtimeTarget } = ctx;
  if (!lastLog) return ["Log last night to get today's personalised guidance."];
  const tips: string[] = [];
  const short = lastLog.hours < target - 1;
  if (short) tips.push(`You slept ${formatHours(lastLog.hours)} — under your ${target}h goal.`);
  if (short || lastLog.quality <= 5) tips.push("Skip intense training today; keep it light or active-recovery.");
  if (short) tips.push("Drink an extra glass of water this morning to offset the deficit.");
  if (netDebtHours <= -2) {
    const t = bedtimeTarget ? `by ${bedtimeTarget}` : "30 minutes earlier";
    tips.push(`You're ${formatHours(Math.abs(netDebtHours))} behind this week — get to bed ${t} tonight.`);
  }
  if (lastLog.quality <= 4) tips.push("Cut screens an hour before bed and keep the room cool and dark.");
  if (!tips.length) {
    tips.push("Solid night — you're clear for a full workout and focused work.");
    tips.push("Hold the same bedtime and wake time to protect your streak.");
  }
  return tips.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Default routines (used until the user customizes them)
// ---------------------------------------------------------------------------
export const DEFAULT_EVENING_ROUTINE = [
  { id: "e-screens", label: "No screens 1h before bed", time: "21:30" },
  { id: "e-magnesium", label: "Magnesium", time: "21:45" },
  { id: "e-journal", label: "Journaling", time: "21:55" },
  { id: "e-read", label: "Read", time: "22:10" },
  { id: "e-lights", label: "Lights off", time: "22:30" },
];

export const DEFAULT_MORNING_ROUTINE = [
  { id: "m-water", label: "Drink water", time: "06:55" },
  { id: "m-stretch", label: "Stretch", time: "07:00" },
  { id: "m-sunlight", label: "Sunlight", time: "07:10" },
  { id: "m-bed", label: "Make bed", time: "07:15" },
  { id: "m-meditate", label: "Meditation", time: "07:20" },
];

export const MOODS = ["😣", "😕", "😐", "🙂", "😄"];

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
