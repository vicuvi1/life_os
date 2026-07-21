// Domain types for the Firestore data model.
// Collections are top-level and owner-scoped by `userId` (see firestore.rules).
// Dates that represent a calendar day are stored as "YYYY-MM-DD" strings;
// `createdAt` / `completedAt` are Firestore server timestamps (ms since epoch on read).

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type Priority = "high" | "medium" | "low";
export type GoalCategory =
  | "education"
  | "career"
  | "certification"
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

/** How completing a habit is measured. */
export type HabitTargetType = "check" | "count" | "duration";

/** Relative effort of a habit; weights the difficulty-adjusted score. */
export type HabitDifficulty = "easy" | "medium" | "hard" | "expert";

/** How a goal's progress is measured. */
export type GoalProgressType = "percent" | "count" | "manual";

/** Value shape of a custom tracker. */
export type TrackerType = "number" | "count" | "duration" | "yesno";

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

/** Categories for money coming IN. */
export type IncomeCategory =
  | "salary"
  | "allowance"
  | "gift"
  | "sale"
  | "refund"
  | "investment"
  | "other";

/** Whether a money entry is money in (income) or money out (expense). */
export type EntryKind = "income" | "expense";

/** Which pot money moves through. */
export type AccountKey = "wallet" | "safe";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: Priority;
  progress: number; // 0-100 (auto for "percent", user-set for "manual")
  /** How progress is measured. Defaults to "percent" (auto from tasks). */
  progressType: GoalProgressType;
  /** For "count" goals: the target to reach and the current value. */
  targetValue: number | null;
  currentValue: number | null;
  /** Optional unit label for count goals, e.g. "$", "pages". */
  unit: string | null;
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
  /** Optional custom emoji shown as the habit's icon (e.g. "💧"). */
  emoji: string | null;
  /** Free-form tags for grouping/filtering (e.g. ["health", "morning"]). */
  tags: string[];
  frequency: HabitFrequency;
  /** Built-in key (HabitCategory) or any custom category name; null = none. */
  category: string | null;
  color: string | null;
  /** Manual sort position (lower = earlier). Defaults to createdAt order. */
  sortOrder: number;
  /** How completion is measured. Defaults to "check" (yes/no). */
  targetType: HabitTargetType;
  /** For count/duration habits: the daily target (glasses, minutes, …). */
  targetValue: number | null;
  /** Effort level; defaults to "medium". Weights the difficulty-adjusted score. */
  difficulty: HabitDifficulty;
  /** Archived habits are hidden from the tracker but keep their full history. */
  archived: boolean;
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
  /** For count/duration habits: the amount logged that day. */
  value: number | null;
  /** Optional freeform note for that day (e.g. "felt tired", "80kg bench"). */
  note: string | null;
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

/**
 * A single money entry — income or expense. (The interface keeps the historical
 * name `Expense`, and the Firestore collection is still `expenses`, so existing
 * documents keep working: they default to kind "expense" in the wallet.)
 */
export interface Expense {
  id: string;
  userId: string;
  /** Money in ("income") or money out ("expense"). Defaults to "expense". */
  kind: EntryKind;
  amount: number;
  /** Which account the money moved through. Defaults to "wallet". */
  account: AccountKey;
  /** ExpenseCategory for expenses, IncomeCategory for income (stored as a string). */
  category: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

/** How often a recurring rule repeats. */
export type RecurringFrequency = "weekly" | "monthly" | "yearly";

/**
 * A recurring money rule (salary, rent, subscription…). Stored embedded on the
 * user's {@link Budget} doc so no extra collection/security rule is needed. It
 * repeats on its schedule (weekly weekday / monthly day / yearly month+day) and
 * can be posted as a real entry; `autopost` rules post themselves, and
 * `lastPosted` guards against double-posting within a period.
 */
export interface RecurringRule {
  id: string;
  kind: EntryKind;
  amount: number;
  account: AccountKey;
  category: string;
  note: string | null;
  /** How often it repeats. */
  frequency: RecurringFrequency;
  /** Day of month, 1-31 (used by monthly + yearly; clamped to month length). */
  dayOfMonth: number;
  /** Month of year, 1-12 (yearly only). */
  monthOfYear: number;
  /** Weekday, 0=Sun … 6=Sat (weekly only). */
  weekday: number;
  autopost: boolean;
  active: boolean;
  /** "YYYY-MM-DD" of the last posted occurrence. */
  lastPosted: string | null;
}

/** One budget config per user (doc id = userId). */
export interface Budget {
  userId: string;
  currency: string; // currency code, e.g. "MDL"
  monthlyTotal: number | null; // overall monthly cap
  byCategory: Partial<Record<string, number>>; // optional per-category caps
  /** Starting balance for each account (e.g. what's already in your safe). */
  openingBalances?: Partial<Record<AccountKey, number>>;
  /** Savings-goal target amount (progress is measured against net worth). */
  savingsGoal?: number | null;
  /** Recurring money rules (salary/rent/subscriptions). */
  recurring?: RecurringRule[];
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

/** A user-defined metric tracked alongside the built-in trackers. */
export interface Tracker {
  id: string;
  userId: string;
  name: string;
  type: TrackerType;
  /** Unit label shown next to values, e.g. "min", "apps", "kg". */
  unit: string | null;
  /** Optional daily target. For yesno trackers this is ignored. */
  target: number | null;
  /** Lucide icon key (see TRACKER_ICONS in lib/trackers.ts). */
  icon: string;
  sortOrder: number;
  archived: boolean;
  createdAt: number;
}

/** One logged value per tracker per day (doc id = userId_trackerId_date). */
export interface TrackerLog {
  id: string;
  userId: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  value: number; // yesno: 1 = yes
}

/** Wash-cycle status of a clothing item (needs-ironing is a separate flag). */
export type WardrobeStatus =
  | "clean"
  | "worn"
  | "dirty"
  | "washing"
  | "drying"
  | "ready";

/**
 * A wardrobe item. All photos are stored inline as compressed data URLs
 * (Firebase Storage needs the paid plan): `imageData` is the primary
 * thumbnail used everywhere; `extraImages` holds up to 3 more shots that are
 * only rendered on the item detail view.
 */
export interface ClothingItem {
  id: string;
  userId: string;
  name: string;
  /** Legacy free-form tags (kept for back-compat with the Routines widget). */
  tags: string[];
  /** Primary square thumbnail as a data URL (client-compressed), or null. */
  imageData: string | null;
  /** Additional photos (front/back/detail), compressed data URLs. Max 3. */
  extraImages: string[];
  /** User-extensible category name (e.g. "Tops"), or null. */
  category: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  /** User-extensible season tags (e.g. ["Summer"]). */
  seasons: string[];
  /** User-extensible style tags (e.g. ["Casual", "Sport"]). */
  styles: string[];
  purchaseDate: string | null; // YYYY-MM-DD
  /** Price in the app's display currency (labelled Price in the UI). */
  cost: number | null;
  status: WardrobeStatus;
  /** Independent flag that can layer on top of any status. */
  needsIroning: boolean;
  favorite: boolean;
  notes: string | null;
  /** Care instructions (wash temperature, dry-clean only, …). */
  care: string | null;
  /** Retired items keep their history but leave active views/builders. */
  retired: boolean;
  timesWorn: number;
  /** Wears since the last wash — drives the Worn-once/twice freshness hint; reset to 0 when laundered. */
  wearsSinceWash: number;
  lastWorn: string | null; // YYYY-MM-DD
  createdAt: number;
}

/**
 * A saved outfit — a named set of wardrobe items. Stored in the `clothing`
 * collection with docType "outfit" (reusing its deployed security rules).
 */
export interface Outfit {
  id: string;
  userId: string;
  name: string;
  /** Templates are intentionally reusable; customs are one-off combos. */
  type: "template" | "custom";
  itemIds: string[];
  /** User-extensible occasion tags (University, Gym, Rainy Day, …). */
  occasions: string[];
  /** Seasons this outfit suits (drives weather-based suggestions). */
  seasons: string[];
  /** 1-5 stars, set after wearing. */
  rating: number | null;
  /** Manually-set fit like "18-28°C, sunny" (displayed, never inferred). */
  weatherFit: string | null;
  notes: string | null;
  favorite: boolean;
  timesWorn: number;
  lastWorn: string | null; // YYYY-MM-DD
  createdAt: number;
}

/**
 * One outfit log per calendar day — either a confirmed past wear or a planned
 * future outfit. Doc id is `${userId}_${date}` so logging is idempotent.
 * Stored in the `clothing` collection with docType "wear".
 */
export interface WearLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  outfitId: string | null;
  itemIds: string[];
  /** true = planned for the future; false = confirmed worn. */
  planned: boolean;
  createdAt: number;
}

/**
 * A trip packing list — pick items from the wardrobe and check them off as you
 * pack. Stored in the `clothing` collection with docType "packing".
 */
export interface PackingList {
  id: string;
  userId: string;
  name: string;
  /** Optional trip length in days (display only). */
  days: number | null;
  itemIds: string[];
  /** Item ids already ticked off. */
  packed: string[];
  createdAt: number;
}

/** A retention rule for one log-like collection (trim data older than `days`). */
export interface RetentionPolicy {
  collection: string;
  days: number;
  enabled: boolean;
  lastRun: number | null; // ms of the last cleanup run
}

/** A point-in-time measurement of the user's estimated data footprint. */
export interface StorageSnapshot {
  at: number; // ms
  totalBytes: number;
  docCount: number;
  byCollection: Record<string, number>; // collection name -> estimated bytes
}

/** Storage-manager config, embedded on the prefs doc (no extra collection). */
export interface StorageConfig {
  policies: RetentionPolicy[];
  snapshots: StorageSnapshot[];
  /** Run enabled policies automatically when the app is opened. */
  autoCleanup: boolean;
}

/** Lightweight per-user preferences (doc id = userId). */
export interface UserPrefs {
  userId: string;
  waterUnit: "glasses" | "liters" | "oz";
  /** Tracker ids (built-in keys or custom ids) the user has hidden. */
  hiddenTrackers: string[];
  /** Nightly sleep goal in hours (used for Good/Low ratings). */
  sleepTarget: number;
  /** Week-score scale for the Weekly Review: rate out of 10 or out of 100. */
  reviewScale: 10 | 100;
  /** Storage monitoring & data-retention config. */
  storage?: StorageConfig | null;
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
  trackers: "trackers",
  trackerLogs: "trackerLogs",
  clothing: "clothing",
  prefs: "prefs",
} as const;
