// Dependency Tracker: correlate daily life factors (sleep, hydration, breakfast)
// with the day's "study quality" (average rated session quality). All pure
// functions over already-collected data — no new storage.

import type { NutritionLog, Session, SleepLog } from "@/lib/types";

export interface DayFactors {
  date: string; // YYYY-MM-DD
  sleepHours: number | null;
  sleepQuality: number | null; // 1-10
  water: number | null;
  waterTarget: number | null;
  breakfast: boolean | null;
  /** Average quality (1-10) of that day's completed, rated sessions. */
  sessionQuality: number | null;
  sessionCount: number;
}

/** Combine per-day data from the three sources into one row per given date. */
export function buildDailyDataset(
  dates: string[],
  sleep: SleepLog[],
  nutrition: NutritionLog[],
  sessions: Session[]
): DayFactors[] {
  const sleepByDate = new Map(sleep.map((s) => [s.date, s]));
  const nutByDate = new Map(nutrition.map((n) => [n.date, n]));
  const sessByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    const arr = sessByDate.get(s.date) ?? [];
    arr.push(s);
    sessByDate.set(s.date, arr);
  }

  return dates.map((date) => {
    const sl = sleepByDate.get(date) ?? null;
    const nu = nutByDate.get(date) ?? null;
    const rated = (sessByDate.get(date) ?? []).filter(
      (x) => x.status === "done" && x.quality != null
    );
    const sessionQuality =
      rated.length > 0
        ? rated.reduce((a, b) => a + (b.quality ?? 0), 0) / rated.length
        : null;

    return {
      date,
      sleepHours: sl ? sl.hours : null,
      sleepQuality: sl ? sl.quality : null,
      water: nu ? nu.water : null,
      waterTarget: nu ? nu.waterTarget : null,
      breakfast: nu ? nu.breakfast : null,
      sessionQuality,
      sessionCount: rated.length,
    };
  });
}

export interface FactorDef {
  key: string;
  label: string;
  /** Past-tense verb phrase for prose, e.g. "on days you ___". */
  phrase: string;
  /** true/false if known that day, null if the underlying data is missing. */
  test: (d: DayFactors) => boolean | null;
}

export const FACTORS: FactorDef[] = [
  {
    key: "sleep7",
    label: "Slept 7h or more",
    phrase: "got 7+ hours of sleep",
    test: (d) => (d.sleepHours == null ? null : d.sleepHours >= 7),
  },
  {
    key: "sleepQuality",
    label: "Good sleep quality (7+)",
    phrase: "slept well",
    test: (d) => (d.sleepQuality == null ? null : d.sleepQuality >= 7),
  },
  {
    key: "breakfast",
    label: "Ate breakfast",
    phrase: "ate breakfast",
    test: (d) => d.breakfast,
  },
  {
    key: "hydrated",
    label: "Hit water goal",
    phrase: "hit your water goal",
    test: (d) =>
      d.water == null || d.waterTarget == null || d.waterTarget <= 0
        ? null
        : d.water >= d.waterTarget,
  },
];

/** Minimum days on EACH side before a factor comparison is trustworthy. */
export const MIN_SAMPLE_PER_SIDE = 2;
/** Stricter bar for the single highlighted "biggest lever" insight. */
export const MIN_INSIGHT_PER_SIDE = 3;

export interface FactorResult {
  key: string;
  label: string;
  phrase: string;
  avgWith: number | null; // avg study quality on days the factor held
  avgWithout: number | null;
  delta: number | null; // avgWith - avgWithout (quality points, 1-10 scale)
  nWith: number;
  nWithout: number;
  /** Enough evidence on both sides to show the comparison at all. */
  hasEnough: boolean;
}

function mean(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * For each factor, compare average study quality on days where the factor was
 * present vs absent. Only days that have BOTH a known factor value and a study
 * quality outcome contribute.
 */
export function computeFactors(data: DayFactors[]): FactorResult[] {
  const outcomeDays = data.filter((d) => d.sessionQuality != null);

  return FACTORS.map((f) => {
    const withVals: number[] = [];
    const withoutVals: number[] = [];
    for (const d of outcomeDays) {
      const t = f.test(d);
      if (t == null) continue; // factor unknown that day
      (t ? withVals : withoutVals).push(d.sessionQuality as number);
    }
    const avgWith = mean(withVals);
    const avgWithout = mean(withoutVals);
    const delta =
      avgWith != null && avgWithout != null ? avgWith - avgWithout : null;
    return {
      key: f.key,
      label: f.label,
      phrase: f.phrase,
      avgWith,
      avgWithout,
      delta,
      nWith: withVals.length,
      nWithout: withoutVals.length,
      hasEnough:
        withVals.length >= MIN_SAMPLE_PER_SIDE &&
        withoutVals.length >= MIN_SAMPLE_PER_SIDE,
    };
  });
}

/**
 * The single most actionable insight: the factor with the largest positive
 * delta that has enough evidence on BOTH sides. null if not enough data.
 */
export function topInsight(factors: FactorResult[]): FactorResult | null {
  const eligible = factors.filter(
    (f) =>
      f.delta != null &&
      f.delta > 0.3 &&
      f.nWith >= MIN_INSIGHT_PER_SIDE &&
      f.nWithout >= MIN_INSIGHT_PER_SIDE
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, f) =>
    (f.delta as number) > (best.delta as number) ? f : best
  );
}

export interface DayRating {
  score: number; // 0-100
  label: "Great" | "Good" | "Mixed" | "Rough";
}

/** A 0-100 wellbeing score for a day from whatever signals are present. */
export function rateDay(d: DayFactors): DayRating | null {
  const parts: number[] = [];
  if (d.sleepHours != null) parts.push(Math.max(0, Math.min(1, d.sleepHours / 8)));
  if (d.sleepQuality != null) parts.push(Math.max(0, Math.min(1, d.sleepQuality / 10)));
  if (d.breakfast != null) parts.push(d.breakfast ? 1 : 0);
  if (d.water != null && d.waterTarget != null && d.waterTarget > 0)
    parts.push(Math.min(1, d.water / d.waterTarget));
  if (d.sessionQuality != null)
    parts.push(Math.max(0, Math.min(1, d.sessionQuality / 10)));

  if (parts.length === 0) return null;
  const score = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  const label =
    score >= 75 ? "Great" : score >= 55 ? "Good" : score >= 35 ? "Mixed" : "Rough";
  return { score, label };
}

/** Short human explanation of what went well / poorly that day. */
export function explainDay(d: DayFactors): string {
  const good: string[] = [];
  const bad: string[] = [];

  if (d.sleepHours != null)
    (d.sleepHours >= 7 ? good : bad).push(
      d.sleepHours >= 7 ? "slept enough" : "low sleep"
    );
  if (d.breakfast != null)
    (d.breakfast ? good : bad).push(
      d.breakfast ? "ate breakfast" : "skipped breakfast"
    );
  if (d.water != null && d.waterTarget != null && d.waterTarget > 0)
    (d.water >= d.waterTarget ? good : bad).push(
      d.water >= d.waterTarget ? "well hydrated" : "under-hydrated"
    );
  if (d.sessionQuality != null)
    (d.sessionQuality >= 7 ? good : bad).push(
      d.sessionQuality >= 7 ? "strong focus" : "weak focus"
    );

  if (good.length === 0 && bad.length === 0) return "Not enough logged.";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (bad.length === 0) return cap(good.join(", ")) + ".";
  if (good.length === 0) return cap(bad.join(", ")) + ".";
  return `${cap(good.join(", "))}; but ${bad.join(", ")}.`;
}
