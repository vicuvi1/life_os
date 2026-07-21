import { daysInMonth } from "@/lib/expenses";
import type { RecurringFrequency, RecurringRule } from "@/lib/types";

export const RECURRING_FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "yearly"];

export const RECURRING_FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Short suffix for amounts, e.g. "9.99 L/mo". */
export const RECURRING_FREQUENCY_ABBREV: Record<RecurringFrequency, string> = {
  weekly: "wk",
  monthly: "mo",
  yearly: "yr",
};

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// --- small date helpers ------------------------------------------------------
function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, daysInMonth(year, month));
}
function mondayOf(d: Date): Date {
  const base = dateOnly(d);
  const offset = (base.getDay() + 6) % 7; // days since Monday
  return addDays(base, -offset);
}
function sameWeek(a: Date, b: Date): boolean {
  return mondayOf(a).getTime() === mondayOf(b).getTime();
}
/** "YYYY-MM-DD" for a Date. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Coerce a raw stored value (possibly from the earlier monthly-only schema) into
 * a fully-formed RecurringRule with sensible defaults. Migrates the legacy
 * `lastPostedMonth` ("YYYY-MM") field to `lastPosted` ("YYYY-MM-DD").
 */
export function normalizeRecurringRule(raw: Record<string, unknown>): RecurringRule {
  const kind = raw?.kind === "income" ? "income" : "expense";
  const frequency: RecurringFrequency =
    raw?.frequency === "weekly" || raw?.frequency === "yearly" ? raw.frequency : "monthly";
  const legacyMonth = typeof raw?.lastPostedMonth === "string" ? `${raw.lastPostedMonth}-01` : null;
  return {
    id: typeof raw?.id === "string" ? raw.id : `r${Math.random().toString(36).slice(2, 10)}`,
    kind,
    amount: typeof raw?.amount === "number" && raw.amount >= 0 ? raw.amount : 0,
    account: raw?.account === "safe" ? "safe" : "wallet",
    category: typeof raw?.category === "string" ? raw.category : kind === "income" ? "salary" : "other",
    note: typeof raw?.note === "string" ? raw.note : null,
    frequency,
    dayOfMonth: clampInt(raw?.dayOfMonth, 1, 31, 1),
    monthOfYear: clampInt(raw?.monthOfYear, 1, 12, 1),
    weekday: clampInt(raw?.weekday, 0, 6, 1),
    autopost: raw?.autopost === true,
    active: raw?.active !== false,
    lastPosted: typeof raw?.lastPosted === "string" ? raw.lastPosted : legacyMonth,
  };
}

/** The scheduled occurrence date within the CURRENT period (may be in the past). */
export function currentPeriodDate(rule: RecurringRule, now: Date): Date {
  const today = dateOnly(now);
  if (rule.frequency === "weekly") {
    return addDays(mondayOf(today), (rule.weekday + 6) % 7);
  }
  if (rule.frequency === "yearly") {
    const y = today.getFullYear();
    const m = rule.monthOfYear - 1;
    return new Date(y, m, clampDay(rule.dayOfMonth, y, m));
  }
  const y = today.getFullYear();
  const m = today.getMonth();
  return new Date(y, m, clampDay(rule.dayOfMonth, y, m));
}

/** The next upcoming renewal date on or after `from`. */
export function nextRenewal(rule: RecurringRule, from: Date): Date {
  const today = dateOnly(from);
  if (rule.frequency === "weekly") {
    const diff = (rule.weekday - today.getDay() + 7) % 7;
    return addDays(today, diff);
  }
  if (rule.frequency === "yearly") {
    const m = rule.monthOfYear - 1;
    let y = today.getFullYear();
    let d = new Date(y, m, clampDay(rule.dayOfMonth, y, m));
    if (d < today) {
      y += 1;
      d = new Date(y, m, clampDay(rule.dayOfMonth, y, m));
    }
    return d;
  }
  let y = today.getFullYear();
  let m = today.getMonth();
  let d = new Date(y, m, clampDay(rule.dayOfMonth, y, m));
  if (d < today) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    d = new Date(y, m, clampDay(rule.dayOfMonth, y, m));
  }
  return d;
}

/** Whether the rule's current-period occurrence has already been posted. */
export function isPostedForCurrentPeriod(rule: RecurringRule, now: Date): boolean {
  if (!rule.lastPosted) return false;
  const last = new Date(`${rule.lastPosted}T00:00:00`);
  if (Number.isNaN(last.getTime())) return false;
  if (rule.frequency === "weekly") return sameWeek(last, now);
  if (rule.frequency === "yearly") return last.getFullYear() === now.getFullYear();
  return last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth();
}

/** Active, its current-period date has arrived, and it hasn't been posted yet. */
export function isDue(rule: RecurringRule, now: Date): boolean {
  if (!rule.active) return false;
  if (isPostedForCurrentPeriod(rule, now)) return false;
  return currentPeriodDate(rule, now) <= dateOnly(now);
}

/** Whole days from `from` until `to` (0 = today). */
export function daysUntil(to: Date, from: Date): number {
  const ms = dateOnly(to).getTime() - dateOnly(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Amount normalized to a per-month figure, for overhead totals. */
export function monthlyEquivalent(rule: RecurringRule): number {
  if (rule.frequency === "weekly") return (rule.amount * 52) / 12;
  if (rule.frequency === "yearly") return rule.amount / 12;
  return rule.amount;
}

/** Human summary of a rule's schedule, e.g. "Monthly · day 5" or "Yearly · Mar 5". */
export function scheduleSummary(rule: RecurringRule): string {
  if (rule.frequency === "weekly") return `Weekly · ${WEEKDAY_LABEL[rule.weekday]}`;
  if (rule.frequency === "yearly") return `Yearly · ${MONTH_LABEL[rule.monthOfYear - 1]} ${rule.dayOfMonth}`;
  return `Monthly · day ${rule.dayOfMonth}`;
}

/** Map of day-of-month → rules that renew on that day, for the given month. */
export function renewalsInMonth(
  rules: RecurringRule[],
  year: number,
  month: number
): Map<number, RecurringRule[]> {
  const map = new Map<number, RecurringRule[]>();
  const dim = daysInMonth(year, month);
  const add = (day: number, rule: RecurringRule) => {
    const list = map.get(day) ?? [];
    list.push(rule);
    map.set(day, list);
  };
  for (const r of rules) {
    if (!r.active) continue;
    if (r.frequency === "monthly") {
      add(Math.min(r.dayOfMonth, dim), r);
    } else if (r.frequency === "yearly") {
      if (r.monthOfYear - 1 === month) add(Math.min(r.dayOfMonth, dim), r);
    } else {
      for (let d = 1; d <= dim; d++) {
        if (new Date(year, month, d).getDay() === r.weekday) add(d, r);
      }
    }
  }
  return map;
}
