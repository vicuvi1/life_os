import { toDateKey } from "@/lib/greeting";
import type { Habit, HabitCategory, HabitDifficulty, HabitLog } from "@/lib/types";

// ---------------------------------------------------------------------------
// Categories & colors
// ---------------------------------------------------------------------------
export const HABIT_CATEGORIES: HabitCategory[] = [
  "morning",
  "evening",
  "exercise",
  "learning",
  "health",
];

export const HABIT_CATEGORY_LABEL: Record<HabitCategory, string> = {
  morning: "Morning",
  evening: "Evening",
  exercise: "Exercise",
  learning: "Learning",
  health: "Health",
};

/** Display label for a category — built-in label, or a Capitalized custom name. */
export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return "";
  return HABIT_CATEGORY_LABEL[cat as HabitCategory] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** Preset colors offered in the habit form (hex). */
export const HABIT_COLORS: { name: string; value: string }[] = [
  { name: "Violet", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Pink", value: "#ec4899" },
  { name: "Lime", value: "#84cc16" },
];

export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].value;

/** Emoji presets offered when picking a habit's icon. */
export const EMOJI_PRESETS = [
  // health & fitness
  "💧", "🏃", "🏋️", "🧘", "💪", "🚴", "🏊", "🤸", "🧗", "🤾", "⛹️", "🥊", "🚶", "🩹", "🩺", "💊", "🦷", "🚿",
  "😴", "🛌", "🚭", "⚖️", "👟", "🧎", "🫀", "🧬", "🩸", "🧠",
  // food & drink
  "🥗", "🥦", "🥕", "🥬", "🍎", "🍌", "🍊", "🫐", "🥚", "🐟", "🍚", "🍳", "🥛", "🧃", "🥤", "🍵", "☕", "🫖",
  "🍽️", "🥘", "🍕", "🍔", "🍜", "🍣", "🍫", "🍪", "🚱", "🍷", "🍺", "🧉",
  // mind & learning
  "📚", "📖", "✍️", "🎯", "🗣️", "🧩", "🎓", "📝", "💡", "🌱", "🙏", "🔬", "🔭", "🧮", "📓", "♟️", "🈯", "🌐",
  "🧑‍🏫", "📔",
  // work & productivity
  "💻", "🖥️", "⌨️", "📅", "🗓️", "✅", "📧", "📊", "📈", "💼", "⏰", "🔧", "🚀", "🗒️", "📋", "📌", "📎", "🧾",
  "🧑‍💻", "🤝", "📁", "🖊️",
  // creative & play
  "🎸", "🎨", "🎹", "📸", "🎬", "🎤", "🕹️", "🎮", "🎼", "🎧", "🥁", "🎻", "🎺", "🎭", "🖌️", "✏️", "🧵", "🎲",
  "🧶", "🪕",
  // lifestyle & home
  "☀️", "🌙", "🛏️", "🧹", "🧺", "🧼", "🪥", "🛒", "🐕", "🐈", "🌿", "🌳", "🌸", "🌷", "🪴", "💰", "💵", "📵",
  "📞", "🧴", "🔋", "🏠", "🛋️", "🚗", "🚲", "🧳", "👨‍👩‍👧", "❤️",
  // nature & outdoors
  "🌊", "🌞", "⭐", "🌈", "🔥", "❄️", "🍃", "🏔️", "🏕️", "🏖️", "🌲", "🌵", "⛰️",
  // feelings & symbols
  "😀", "😊", "🥳", "😌", "🤗", "🤩", "😇", "⚡", "✨", "🔔", "🏁", "🎉", "🏆", "🥇", "🔑", "🧿", "♻️", "📿",
  "🎗️", "➕", "🔵", "🟢", "🟣", "🟠", "🔴",
];

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------
export const DIFFICULTIES: HabitDifficulty[] = ["easy", "medium", "hard", "expert"];

/** Label, points weight, and a color for each difficulty. */
export const DIFFICULTY_META: Record<HabitDifficulty, { label: string; weight: number; color: string }> = {
  easy: { label: "Easy", weight: 1, color: "#10b981" },
  medium: { label: "Medium", weight: 2, color: "#3b82f6" },
  hard: { label: "Hard", weight: 3, color: "#f59e0b" },
  expert: { label: "Expert", weight: 4, color: "#f43f5e" },
};

/** Difficulty-weighted points for N completions of a habit. */
export function difficultyPoints(difficulty: HabitDifficulty, completions: number): number {
  return (DIFFICULTY_META[difficulty]?.weight ?? 2) * completions;
}

// ---------------------------------------------------------------------------
// Streak milestones (celebration messages)
// ---------------------------------------------------------------------------
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 300, 365];

const MILESTONE_MESSAGES: Record<number, string> = {
  3: "3 days in — momentum! 💫",
  7: "A full week! 🔥",
  14: "Two weeks strong 💪",
  21: "21 days — officially a habit! ✨",
  30: "30 days! You're on fire 🚀",
  50: "50 days — incredible 🙌",
  75: "75 days of showing up 👏",
  100: "100 days!! Legend — keep it up, boss 👑",
  150: "150 days of pure discipline 🧠",
  200: "200 days 🤯",
  300: "300 days — nearly a year! 🌟",
  365: "365 DAYS. A FULL YEAR 🏆🎉",
};

/** A celebration line if `streak` just hit a milestone, else null. */
export function streakMilestoneMessage(streak: number): string | null {
  return MILESTONE_MESSAGES[streak] ?? null;
}

// ---------------------------------------------------------------------------
// Completion semantics
// ---------------------------------------------------------------------------
/**
 * Whether a log entry counts the day as DONE for this habit. Check habits are
 * done by existing; count/duration habits are done once the logged value
 * reaches the habit's target.
 */
export function isLogDone(
  habit: Pick<Habit, "targetType" | "targetValue">,
  log: Pick<HabitLog, "value">
): boolean {
  if ((habit.targetType ?? "check") === "check") return true;
  return (log.value ?? 0) >= (habit.targetValue ?? 1);
}

/** The dates on which this habit counted as done, given its logs. */
export function doneDates(
  habit: Pick<Habit, "targetType" | "targetValue">,
  logs: Pick<HabitLog, "completedDate" | "value">[]
): string[] {
  return logs.filter((l) => isLogDone(habit, l)).map((l) => l.completedDate);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
/** Shift a YYYY-MM-DD key by `delta` days. */
export function addDays(key: string, delta: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** The last `n` date keys ending today (oldest → newest). */
export function lastNDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

// ---------------------------------------------------------------------------
// Streak math
// ---------------------------------------------------------------------------
/**
 * Current streak: consecutive completed days ending today (or yesterday, so a
 * streak isn't "broken" until a full day is missed). Returns 0 if neither
 * today nor yesterday is completed.
 */
export function currentStreak(dates: Set<string>, today: string): number {
  let start: string;
  if (dates.has(today)) start = today;
  else if (dates.has(addDays(today, -1))) start = addDays(today, -1);
  else return 0;

  let count = 0;
  let cur = start;
  while (dates.has(cur)) {
    count++;
    cur = addDays(cur, -1);
  }
  return count;
}

/** Longest consecutive-day run anywhere in the history. */
export function longestStreak(dateList: string[]): number {
  const set = new Set(dateList);
  let best = 0;
  for (const d of Array.from(set)) {
    if (set.has(addDays(d, -1))) continue; // not the start of a run
    let count = 0;
    let cur = d;
    while (set.has(cur)) {
      count++;
      cur = addDays(cur, 1);
    }
    best = Math.max(best, count);
  }
  return best;
}

// Frequency-aware streaks: daily habits count consecutive days; weekly habits
// count consecutive ISO-ish weeks (Monday-anchored), so a habit kept once a week
// still builds a streak.
function weekAnchor(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return addDays(dateKey, -((d.getDay() + 6) % 7)); // Monday of that week
}
function weeklyCurrentStreak(dates: string[], today: string): number {
  const weeks = new Set(dates.map(weekAnchor));
  const thisWeek = weekAnchor(today);
  let cur: string;
  if (weeks.has(thisWeek)) cur = thisWeek;
  else if (weeks.has(addDays(thisWeek, -7))) cur = addDays(thisWeek, -7);
  else return 0;
  let count = 0;
  while (weeks.has(cur)) {
    count++;
    cur = addDays(cur, -7);
  }
  return count;
}
function weeklyLongestStreak(dates: string[]): number {
  const weeks = new Set(dates.map(weekAnchor));
  let best = 0;
  for (const w of Array.from(weeks)) {
    if (weeks.has(addDays(w, -7))) continue; // not a run start
    let count = 0;
    let cur = w;
    while (weeks.has(cur)) {
      count++;
      cur = addDays(cur, 7);
    }
    best = Math.max(best, count);
  }
  return best;
}

/** Current streak honoring the habit's cadence (days for daily, weeks for weekly). */
export function habitCurrentStreak(
  habit: Pick<Habit, "frequency">,
  dates: string[],
  today: string
): number {
  return (habit.frequency ?? "daily") === "weekly"
    ? weeklyCurrentStreak(dates, today)
    : currentStreak(new Set(dates), today);
}

/** Longest streak honoring the habit's cadence. */
export function habitLongestStreak(habit: Pick<Habit, "frequency">, dates: string[]): number {
  return (habit.frequency ?? "daily") === "weekly" ? weeklyLongestStreak(dates) : longestStreak(dates);
}

export interface HabitState {
  completedToday: boolean;
  streak: number;
  best: number;
  /** Completion flags for the last 7 days, oldest → newest. */
  last7: boolean[];
}

/** Derive display state for a habit from its completed dates. */
export function habitStateFromDates(
  dateList: string[],
  today: string
): HabitState {
  const set = new Set(dateList);
  return {
    completedToday: set.has(today),
    streak: currentStreak(set, today),
    best: longestStreak(dateList),
    last7: lastNDays(today, 7).map((d) => set.has(d)),
  };
}

// ---------------------------------------------------------------------------
// Per-day status (for the tracker grid, heatmap, and summary)
// ---------------------------------------------------------------------------
/**
 * completed = target met · partial = logged but below target · missed = a past
 * daily-habit day with no log · none = no log on today/future, a weekly habit,
 * or a day before the habit existed.
 */
export type DayStatus = "completed" | "partial" | "missed" | "none";

export function dayStatus(
  habit: Pick<Habit, "targetType" | "targetValue" | "frequency">,
  log: Pick<HabitLog, "value"> | undefined,
  dateKey: string,
  today: string,
  createdKey?: string
): DayStatus {
  if (log) return isLogDone(habit, log) ? "completed" : "partial";
  if (createdKey && dateKey < createdKey) return "none";
  if (dateKey < today && (habit.frequency ?? "daily") === "daily") return "missed";
  return "none";
}

/** A day counts toward the completion rate only if it was expected (not "none"). */
export function isScheduled(status: DayStatus): boolean {
  return status !== "none";
}

export interface StatusTally {
  completed: number;
  partial: number;
  missed: number;
  none: number;
  scheduled: number; // completed + partial + missed
  /** completed / scheduled, 0-100 (0 when nothing was scheduled). */
  rate: number;
}

/** Tally a flat list of day statuses into counts + a completion rate. */
export function tallyStatuses(statuses: DayStatus[]): StatusTally {
  let completed = 0;
  let partial = 0;
  let missed = 0;
  let none = 0;
  for (const s of statuses) {
    if (s === "completed") completed++;
    else if (s === "partial") partial++;
    else if (s === "missed") missed++;
    else none++;
  }
  const scheduled = completed + partial + missed;
  return { completed, partial, missed, none, scheduled, rate: scheduled > 0 ? (completed / scheduled) * 100 : 0 };
}
