import type { WeekdayKey } from "@/lib/types";

export const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

/** Weekday key for a Date, Monday-first. */
export function weekdayKey(d: Date): WeekdayKey {
  const idx = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  return WEEKDAYS[idx].key;
}

export function weekdayLabel(key: WeekdayKey): string {
  return WEEKDAYS.find((w) => w.key === key)?.label ?? key;
}

/** Suggested starter defaults shown to first-time users (not persisted). */
export const DEFAULT_SUGGESTIONS: { label: string; value: string }[] = [
  { label: "Wake up", value: "6:00 AM" },
  { label: "Bedtime", value: "10:30 PM" },
  { label: "Entertainment", value: "30 min / day" },
  { label: "Laundry", value: "Wednesday evening" },
];
