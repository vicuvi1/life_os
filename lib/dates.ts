import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export { WEEKDAYS_SHORT };

/** Monday (ISO week start) for the week containing the given date key. */
export function startOfWeekKey(key: string): string {
  const d = new Date(key + "T00:00:00");
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

/** e.g. "Jul 14 – Jul 20, 2026" for a Monday week-start key. */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sM = MONTHS[s.getMonth()].slice(0, 3);
  const eM = MONTHS[e.getMonth()].slice(0, 3);
  return `${sM} ${s.getDate()} – ${eM} ${e.getDate()}, ${e.getFullYear()}`;
}

/** e.g. "July 2026". */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Long human date, e.g. "Monday, Jul 20". */
export function formatLongDate(key: string): string {
  const d = new Date(key + "T00:00:00");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${wd}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/**
 * A 6×7 grid of date keys for a calendar month, weeks starting Monday.
 * Includes trailing/leading days from adjacent months to fill the grid.
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = toDateKey(new Date(year, month, 1));
  let cur = startOfWeekKey(first);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/** Whether a date key belongs to the given month. */
export function isInMonth(key: string, year: number, month: number): boolean {
  const d = new Date(key + "T00:00:00");
  return d.getFullYear() === year && d.getMonth() === month;
}

/** Day-of-month number from a date key. */
export function dayNum(key: string): number {
  return new Date(key + "T00:00:00").getDate();
}
