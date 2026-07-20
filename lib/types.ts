// Domain types for the Firestore data model.
// Collections are top-level and owner-scoped by `userId` (see firestore.rules).
// Dates that represent a calendar day are stored as "YYYY-MM-DD" strings;
// `createdAt` / `completedAt` are Firestore server timestamps (ms since epoch on read).

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type Priority = "high" | "medium" | "low";
export type GoalCategory =
  | "education"
  | "career"
  | "health"
  | "financial"
  | "personal";

export type ProjectStatus = "not_started" | "in_progress" | "completed";
export type TaskStatus = "todo" | "in_progress" | "done";

export type HabitFrequency = "daily" | "weekly";
export type HabitCategory =
  | "morning"
  | "evening"
  | "exercise"
  | "learning"
  | "health";

export type SessionCategory =
  | "study"
  | "workout"
  | "deep_work"
  | "admin"
  | "personal"
  | "other";
export type SessionStatus = "planned" | "done" | "skipped";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "fitness"
  | "entertainment"
  | "education"
  | "health"
  | "other";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: Priority;
  progress: number; // 0-100
  deadline: string | null; // YYYY-MM-DD
  quarter: string | null;
  category: GoalCategory | null;
  createdAt: number;
}

export interface Project {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  sortOrder: number;
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string | null;
  goalId: string | null;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  category: HabitCategory | null;
  color: string | null;
  streak: number;
  bestStreak: number;
  lastCompleted: string | null; // YYYY-MM-DD
  createdAt: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  completedDate: string; // YYYY-MM-DD
  createdAt: number;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: string; // YYYY-MM-DD
  accomplishments: string | null;
  blockers: string | null;
  nextWeekFocus: string | null;
  score: number | null; // 0-100
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  category: SessionCategory;
  /** Optional link to a goal (e.g. "Spanish study" → C1 English goal). */
  goalId: string | null;
  date: string; // YYYY-MM-DD
  startMin: number; // minutes since midnight (e.g. 7:00 = 420)
  endMin: number; // minutes since midnight, > startMin
  status: SessionStatus;
  /** Post-session quality rating 1-10 (null until rated). */
  quality: number | null;
  notes: string | null;
  color: string | null;
  /** Repeat this block on the same weekday going forward (UI convenience). */
  createdAt: number;
}

export interface SleepLog {
  id: string;
  userId: string;
  date: string; // the morning you woke up (YYYY-MM-DD)
  hours: number; // e.g. 7.5
  quality: number; // 1-10
  notes: string | null;
  createdAt: number;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  water: number; // glasses consumed
  waterTarget: number; // daily goal (default 8)
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  calories: number | null; // optional total for the day
  notes: string | null;
  createdAt: number;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

/** One budget config per user (doc id = userId). */
export interface Budget {
  userId: string;
  currency: string; // symbol, e.g. "$"
  monthlyTotal: number | null; // overall monthly cap
  byCategory: Partial<Record<ExpenseCategory, number>>; // optional per-category caps
}

/** A reusable meal in the user's library. */
export interface Meal {
  id: string;
  userId: string;
  name: string;
  slot: MealSlot;
  ingredients: string[];
  estCost: number | null;
  createdAt: number;
}

/** A meal assigned to a specific date + slot (doc id = userId_date_slot). */
export interface MealPlanEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  mealId: string;
}

/** Shopping-list state for a week (doc id = userId_weekStart). */
export interface ShoppingCheck {
  userId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  checked: string[]; // normalized item names checked off
  extra: string[]; // manually added items
}

export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

/** Pre-decided daily defaults (doc id = userId) — the "zero decision" config. */
export interface DecisionConfig {
  userId: string;
  outfits: Partial<Record<WeekdayKey, string>>; // outfit per weekday
  defaults: { label: string; value: string }[]; // fixed decisions (bedtime, etc.)
}

/** Firestore collection names, centralized to avoid typos. */
export const COLLECTIONS = {
  goals: "goals",
  projects: "projects",
  tasks: "tasks",
  habits: "habits",
  habitLogs: "habitLogs",
  weeklyReviews: "weeklyReviews",
  sessions: "sessions",
  sleepLogs: "sleepLogs",
  nutritionLogs: "nutritionLogs",
  expenses: "expenses",
  budgets: "budgets",
  meals: "meals",
  mealPlan: "mealPlan",
  shoppingChecks: "shoppingChecks",
  decisions: "decisions",
} as const;
