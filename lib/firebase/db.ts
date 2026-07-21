import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
  COLLECTIONS,
  type Budget,
  type ClothingItem,
  type DecisionConfig,
  type Expense,
  type Goal,
  type Habit,
  type HabitLog,
  type Meal,
  type MealPlanEntry,
  type MealSlot,
  type NutritionLog,
  type Project,
  type RecurringRule,
  type Session,
  type ShoppingCheck,
  type SleepLog,
  type Task,
  type Tracker,
  type TrackerLog,
  type UserPrefs,
  type WeeklyReview,
} from "@/lib/types";
import { currentStreak, longestStreak, isLogDone } from "@/lib/habits";
import { toDateKey } from "@/lib/greeting";

/** Convert a Firestore Timestamp (or null during pending writes) to epoch ms. */
function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return 0;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
function mapGoal(snap: QueryDocumentSnapshot<DocumentData>): Goal {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    title: d.title,
    description: d.description ?? null,
    status: d.status ?? "active",
    priority: d.priority ?? "medium",
    progress: d.progress ?? 0,
    progressType: d.progressType ?? "percent",
    targetValue: d.targetValue ?? null,
    currentValue: d.currentValue ?? null,
    unit: d.unit ?? null,
    deadline: d.deadline ?? null,
    quarter: d.quarter ?? null,
    category: d.category ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapProject(snap: QueryDocumentSnapshot<DocumentData>): Project {
  const d = snap.data();
  return {
    id: snap.id,
    goalId: d.goalId,
    userId: d.userId,
    title: d.title,
    description: d.description ?? null,
    status: d.status ?? "not_started",
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

function mapTask(snap: QueryDocumentSnapshot<DocumentData>): Task {
  const d = snap.data();
  return {
    id: snap.id,
    projectId: d.projectId ?? null,
    goalId: d.goalId ?? null,
    userId: d.userId,
    title: d.title,
    description: d.description ?? null,
    status: d.status ?? "todo",
    priority: d.priority ?? "medium",
    dueDate: d.dueDate ?? null,
    completedAt: d.completedAt ? toMillis(d.completedAt) : null,
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

function mapHabit(snap: QueryDocumentSnapshot<DocumentData>): Habit {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    title: d.title,
    description: d.description ?? null,
    frequency: d.frequency ?? "daily",
    category: d.category ?? null,
    color: d.color ?? null,
    targetType: d.targetType ?? "check",
    targetValue: d.targetValue ?? null,
    streak: d.streak ?? 0,
    bestStreak: d.bestStreak ?? 0,
    lastCompleted: d.lastCompleted ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export async function getGoals(userId: string): Promise<Goal[]> {
  const q = query(
    collection(db, COLLECTIONS.goals),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapGoal)
    .sort((a, b) => {
      const p =
        (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      return p !== 0 ? p : b.createdAt - a.createdAt;
    });
}

export async function getActiveGoals(userId: string, max = 3): Promise<Goal[]> {
  const goals = await getGoals(userId);
  return goals.filter((g) => g.status === "active").slice(0, max);
}

/**
 * Goals tagged as certifications that are still being worked on (excludes
 * completed and archived). Powers the Career section in the sidebar.
 */
export async function getCertificationGoals(userId: string): Promise<Goal[]> {
  const goals = await getGoals(userId);
  return goals.filter(
    (g) =>
      g.category === "certification" &&
      g.status !== "archived" &&
      g.status !== "completed"
  );
}

export async function getGoal(id: string): Promise<Goal | null> {
  const ref = doc(db, COLLECTIONS.goals, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapGoal(snap as QueryDocumentSnapshot<DocumentData>);
}

export type GoalInput = Pick<
  Goal,
  | "title"
  | "description"
  | "status"
  | "priority"
  | "deadline"
  | "quarter"
  | "category"
  | "progressType"
  | "targetValue"
  | "currentValue"
  | "unit"
> & { progress?: number };

export async function createGoal(
  userId: string,
  input: GoalInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.goals), {
    userId,
    progress: 0, // default; count/manual goals may pass their own via input
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGoal(
  id: string,
  input: Partial<GoalInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.goals, id), { ...input });
}

export async function deleteGoal(id: string): Promise<void> {
  // Cascade-delete the goal's projects and tasks (Firestore has no FK cascade).
  const batch = writeBatch(db);

  const projSnap = await getDocs(
    query(collection(db, COLLECTIONS.projects), where("goalId", "==", id))
  );
  projSnap.forEach((p) => batch.delete(p.ref));

  const taskSnap = await getDocs(
    query(collection(db, COLLECTIONS.tasks), where("goalId", "==", id))
  );
  taskSnap.forEach((t) => batch.delete(t.ref));

  batch.delete(doc(db, COLLECTIONS.goals, id));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export async function getProjects(userId: string): Promise<Project[]> {
  const q = query(
    collection(db, COLLECTIONS.projects),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapProject).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProjectsForGoal(goalId: string): Promise<Project[]> {
  const q = query(
    collection(db, COLLECTIONS.projects),
    where("goalId", "==", goalId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapProject).sort((a, b) => a.createdAt - b.createdAt);
}

export type ProjectInput = Pick<
  Project,
  "title" | "description" | "status"
>;

export async function createProject(
  userId: string,
  goalId: string,
  input: ProjectInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.projects), {
    userId,
    goalId,
    ...input,
    sortOrder: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(
  id: string,
  input: Partial<ProjectInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.projects, id), { ...input });
}

export async function deleteProject(id: string): Promise<void> {
  const batch = writeBatch(db);
  const taskSnap = await getDocs(
    query(collection(db, COLLECTIONS.tasks), where("projectId", "==", id))
  );
  taskSnap.forEach((t) => batch.delete(t.ref));
  batch.delete(doc(db, COLLECTIONS.projects, id));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export async function getTasks(userId: string): Promise<Task[]> {
  const q = query(
    collection(db, COLLECTIONS.tasks),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapTask).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTasksForGoal(goalId: string): Promise<Task[]> {
  const q = query(
    collection(db, COLLECTIONS.tasks),
    where("goalId", "==", goalId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapTask).sort((a, b) => a.createdAt - b.createdAt);
}

export type TaskInput = Pick<
  Task,
  "title" | "description" | "priority" | "dueDate" | "projectId" | "goalId"
>;

export async function createTask(
  userId: string,
  input: TaskInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.tasks), {
    userId,
    ...input,
    status: "todo",
    completedAt: null,
    sortOrder: 0,
    createdAt: serverTimestamp(),
  });
  if (input.goalId) await recalcGoalProgress(input.goalId);
  return ref.id;
}

export async function updateTask(
  id: string,
  input: Partial<TaskInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.tasks, id), { ...input });
}

/** Toggle a task between done and todo, then recalc its goal's progress. */
export async function setTaskDone(
  task: Pick<Task, "id" | "goalId">,
  done: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.tasks, task.id), {
    status: done ? "done" : "todo",
    completedAt: done ? serverTimestamp() : null,
  });
  if (task.goalId) await recalcGoalProgress(task.goalId);
}

export async function deleteTask(
  task: Pick<Task, "id" | "goalId">
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.tasks, task.id));
  if (task.goalId) await recalcGoalProgress(task.goalId);
}

/**
 * Recompute a goal's progress as the % of its tasks marked done, and persist
 * it on the goal document. Called after any task mutation. Only applies to
 * goals whose progressType is "percent" — count and manual goals own their
 * progress and must never be clobbered by task changes.
 */
export async function recalcGoalProgress(goalId: string): Promise<number> {
  const goalRef = doc(db, COLLECTIONS.goals, goalId);
  const goalSnap = await getDoc(goalRef);
  if (!goalSnap.exists()) return 0;
  const progressType = goalSnap.data().progressType ?? "percent";
  if (progressType !== "percent") return goalSnap.data().progress ?? 0;

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.tasks), where("goalId", "==", goalId))
  );
  const tasks = snap.docs.map((t) => t.data());
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  await updateDoc(goalRef, { progress });
  return progress;
}

/** Update a count-type goal's current value and derive its progress %. */
export async function setGoalCurrentValue(
  goal: Pick<Goal, "id" | "targetValue">,
  currentValue: number
): Promise<void> {
  const target = goal.targetValue ?? 0;
  const progress =
    target > 0 ? Math.max(0, Math.min(100, Math.round((currentValue / target) * 100))) : 0;
  await updateDoc(doc(db, COLLECTIONS.goals, goal.id), { currentValue, progress });
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
function mapHabitLog(snap: QueryDocumentSnapshot<DocumentData>): HabitLog {
  const d = snap.data();
  return {
    id: snap.id,
    habitId: d.habitId,
    userId: d.userId,
    completedDate: d.completedDate,
    value: d.value ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getHabits(userId: string): Promise<Habit[]> {
  const q = query(
    collection(db, COLLECTIONS.habits),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapHabit).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getDailyHabits(userId: string): Promise<Habit[]> {
  const habits = await getHabits(userId);
  return habits.filter((h) => h.frequency === "daily");
}

/** All habit logs for a user (used to derive completion + streaks client-side). */
export async function getHabitLogs(userId: string): Promise<HabitLog[]> {
  const q = query(
    collection(db, COLLECTIONS.habitLogs),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapHabitLog);
}

export type HabitInput = Pick<
  Habit,
  | "title"
  | "description"
  | "frequency"
  | "category"
  | "color"
  | "targetType"
  | "targetValue"
>;

export async function createHabit(
  userId: string,
  input: HabitInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.habits), {
    userId,
    ...input,
    streak: 0,
    bestStreak: 0,
    lastCompleted: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateHabit(
  id: string,
  input: Partial<HabitInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.habits, id), { ...input });
}

export async function deleteHabit(id: string): Promise<void> {
  const batch = writeBatch(db);
  const logSnap = await getDocs(
    query(collection(db, COLLECTIONS.habitLogs), where("habitId", "==", id))
  );
  logSnap.forEach((l) => batch.delete(l.ref));
  batch.delete(doc(db, COLLECTIONS.habits, id));
  await batch.commit();
}

/**
 * Recompute a habit's streaks from its full log history, honoring completion
 * semantics: count/duration habits only count a day once the logged value
 * reaches the target.
 */
async function recomputeHabitStreaks(habitId: string): Promise<void> {
  const habitRef = doc(db, COLLECTIONS.habits, habitId);
  const habitSnap = await getDoc(habitRef);
  if (!habitSnap.exists()) return;
  const habit = {
    targetType: habitSnap.data().targetType ?? "check",
    targetValue: habitSnap.data().targetValue ?? null,
  };

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.habitLogs), where("habitId", "==", habitId))
  );
  const dates = snap.docs
    .filter((d) => isLogDone(habit, { value: d.data().value ?? null }))
    .map((d) => d.data().completedDate as string);
  const today = toDateKey(new Date());
  const streak = currentStreak(new Set(dates), today);
  const best = longestStreak(dates);
  const lastCompleted =
    dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  await updateDoc(habitRef, { streak, bestStreak: best, lastCompleted });
}

/**
 * Mark (or unmark) a check-type habit as done for a given date.
 * Log docs use a deterministic id (`habitId_date`) so completion is idempotent.
 * For count/duration habits this writes the full target value (a checkbox tap
 * means "hit the target") — use setHabitLogValue for partial amounts.
 */
export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date: string,
  done: boolean,
  fullValue: number | null = null
): Promise<void> {
  const logRef = doc(db, COLLECTIONS.habitLogs, `${habitId}_${date}`);
  if (done) {
    await setDoc(logRef, {
      userId,
      habitId,
      completedDate: date,
      value: fullValue,
      createdAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(logRef);
  }
  await recomputeHabitStreaks(habitId);
}

/** Log a partial/exact value for a count or duration habit on a given date. */
export async function setHabitLogValue(
  userId: string,
  habitId: string,
  date: string,
  value: number
): Promise<void> {
  const logRef = doc(db, COLLECTIONS.habitLogs, `${habitId}_${date}`);
  if (value <= 0) {
    await deleteDoc(logRef);
  } else {
    await setDoc(logRef, {
      userId,
      habitId,
      completedDate: date,
      value,
      createdAt: serverTimestamp(),
    });
  }
  await recomputeHabitStreaks(habitId);
}

// ---------------------------------------------------------------------------
// Weekly reviews
// ---------------------------------------------------------------------------
function mapWeeklyReview(snap: QueryDocumentSnapshot<DocumentData>): WeeklyReview {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    weekStart: d.weekStart,
    accomplishments: d.accomplishments ?? null,
    blockers: d.blockers ?? null,
    nextWeekFocus: d.nextWeekFocus ?? null,
    score: d.score ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getWeeklyReviews(userId: string): Promise<WeeklyReview[]> {
  const q = query(
    collection(db, COLLECTIONS.weeklyReviews),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapWeeklyReview)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

export async function getWeeklyReview(
  userId: string,
  weekStart: string
): Promise<WeeklyReview | null> {
  const ref = doc(db, COLLECTIONS.weeklyReviews, `${userId}_${weekStart}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapWeeklyReview(snap as QueryDocumentSnapshot<DocumentData>);
}

export type WeeklyReviewInput = Pick<
  WeeklyReview,
  "accomplishments" | "blockers" | "nextWeekFocus" | "score"
>;

/** Create or update the review for a given week (one review per week). */
export async function upsertWeeklyReview(
  userId: string,
  weekStart: string,
  input: WeeklyReviewInput
): Promise<void> {
  const ref = doc(db, COLLECTIONS.weeklyReviews, `${userId}_${weekStart}`);
  await setDoc(
    ref,
    {
      userId,
      weekStart,
      ...input,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteWeeklyReview(
  userId: string,
  weekStart: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.weeklyReviews, `${userId}_${weekStart}`));
}

// ---------------------------------------------------------------------------
// Sessions (timed study/workout/etc. blocks)
// ---------------------------------------------------------------------------
function mapSession(snap: QueryDocumentSnapshot<DocumentData>): Session {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    title: d.title,
    category: d.category ?? "other",
    goalId: d.goalId ?? null,
    date: d.date,
    startMin: d.startMin ?? 0,
    endMin: d.endMin ?? 0,
    status: d.status ?? "planned",
    quality: d.quality ?? null,
    notes: d.notes ?? null,
    color: d.color ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

/** All sessions for a user (sorted by date then start time). */
export async function getSessions(userId: string): Promise<Session[]> {
  const q = query(
    collection(db, COLLECTIONS.sessions),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapSession)
    .sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startMin - b.startMin
    );
}

/** Sessions within an inclusive date-key range (client-side filter). */
export async function getSessionsInRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<Session[]> {
  const all = await getSessions(userId);
  return all.filter((s) => s.date >= fromDate && s.date <= toDate);
}

export type SessionInput = Pick<
  Session,
  | "title"
  | "category"
  | "goalId"
  | "date"
  | "startMin"
  | "endMin"
  | "status"
  | "quality"
  | "notes"
  | "color"
>;

export async function createSession(
  userId: string,
  input: SessionInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.sessions), {
    userId,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSession(
  id: string,
  input: Partial<SessionInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.sessions, id), { ...input });
}

export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.sessions, id));
}

// ---------------------------------------------------------------------------
// Sleep logs (one per night, keyed by wake date)
// ---------------------------------------------------------------------------
function mapSleepLog(snap: QueryDocumentSnapshot<DocumentData>): SleepLog {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    date: d.date,
    hours: d.hours ?? 0,
    quality: d.quality ?? 0,
    notes: d.notes ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getSleepLogs(userId: string): Promise<SleepLog[]> {
  const q = query(
    collection(db, COLLECTIONS.sleepLogs),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapSleepLog)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getSleepLog(
  userId: string,
  date: string
): Promise<SleepLog | null> {
  const ref = doc(db, COLLECTIONS.sleepLogs, `${userId}_${date}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapSleepLog(snap as QueryDocumentSnapshot<DocumentData>);
}

export type SleepLogInput = Pick<SleepLog, "hours" | "quality" | "notes">;

export async function upsertSleepLog(
  userId: string,
  date: string,
  input: SleepLogInput
): Promise<void> {
  const ref = doc(db, COLLECTIONS.sleepLogs, `${userId}_${date}`);
  const existing = await getDoc(ref);
  // Only stamp createdAt on first creation so merge-writes don't reset it.
  const created = existing.exists() ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, { userId, date, ...input, ...created }, { merge: true });
}

export async function deleteSleepLog(
  userId: string,
  date: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.sleepLogs, `${userId}_${date}`));
}

// ---------------------------------------------------------------------------
// Nutrition & water logs (one per day)
// ---------------------------------------------------------------------------
function mapNutritionLog(
  snap: QueryDocumentSnapshot<DocumentData>
): NutritionLog {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    date: d.date,
    water: d.water ?? 0,
    waterTarget: d.waterTarget ?? 8,
    breakfast: d.breakfast ?? false,
    lunch: d.lunch ?? false,
    dinner: d.dinner ?? false,
    calories: d.calories ?? null,
    notes: d.notes ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getNutritionLogs(
  userId: string
): Promise<NutritionLog[]> {
  const q = query(
    collection(db, COLLECTIONS.nutritionLogs),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapNutritionLog)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getNutritionLog(
  userId: string,
  date: string
): Promise<NutritionLog | null> {
  const ref = doc(db, COLLECTIONS.nutritionLogs, `${userId}_${date}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapNutritionLog(snap as QueryDocumentSnapshot<DocumentData>);
}

export type NutritionLogInput = Pick<
  NutritionLog,
  | "water"
  | "waterTarget"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "calories"
  | "notes"
>;

export async function upsertNutritionLog(
  userId: string,
  date: string,
  input: Partial<NutritionLogInput>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.nutritionLogs, `${userId}_${date}`);
  const existing = await getDoc(ref);
  // Only stamp createdAt on first creation so merge-writes don't reset it.
  const created = existing.exists() ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, { userId, date, ...input, ...created }, { merge: true });
}

export async function deleteNutritionLog(
  userId: string,
  date: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.nutritionLogs, `${userId}_${date}`));
}

// ---------------------------------------------------------------------------
// Expenses & budget
// ---------------------------------------------------------------------------
function mapExpense(snap: QueryDocumentSnapshot<DocumentData>): Expense {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    // Legacy docs have no kind/account — treat them as wallet expenses.
    kind: d.kind === "income" ? "income" : "expense",
    amount: d.amount ?? 0,
    account: d.account === "safe" ? "safe" : "wallet",
    category: d.category ?? "other",
    note: d.note ?? null,
    date: d.date,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const q = query(
    collection(db, COLLECTIONS.expenses),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapExpense)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

export type ExpenseInput = Pick<
  Expense,
  "kind" | "amount" | "account" | "category" | "note" | "date"
>;

export async function createExpense(
  userId: string,
  input: ExpenseInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.expenses), {
    userId,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateExpense(
  id: string,
  input: Partial<ExpenseInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.expenses, id), { ...input });
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.expenses, id));
}

export async function getBudget(userId: string): Promise<Budget | null> {
  const ref = doc(db, COLLECTIONS.budgets, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    userId: d.userId,
    currency: d.currency ?? "MDL",
    monthlyTotal: d.monthlyTotal ?? null,
    byCategory: d.byCategory ?? {},
    openingBalances: d.openingBalances ?? {},
    savingsGoal: d.savingsGoal ?? null,
    recurring: Array.isArray(d.recurring) ? (d.recurring as RecurringRule[]) : [],
  };
}

export type BudgetInput = Pick<
  Budget,
  "currency" | "monthlyTotal" | "byCategory" | "openingBalances" | "savingsGoal"
>;

export async function upsertBudget(
  userId: string,
  input: BudgetInput
): Promise<void> {
  const ref = doc(db, COLLECTIONS.budgets, userId);
  // Full replace (no merge): the budget form always submits the complete
  // config, and merge would keep stale per-category caps the user cleared.
  // Recurring rules aren't part of the budget form, so carry them through
  // rather than wiping them on every budget save.
  const snap = await getDoc(ref);
  const recurring = snap.exists() && Array.isArray(snap.data().recurring)
    ? snap.data().recurring
    : [];
  await setDoc(ref, { userId, ...input, recurring });
}

/**
 * Persist just the recurring rules on the budget doc. Uses a merge write so it
 * leaves the rest of the budget untouched (and creates the doc, stamped with
 * userId, if it doesn't exist yet).
 */
export async function setRecurringRules(
  userId: string,
  recurring: RecurringRule[]
): Promise<void> {
  const ref = doc(db, COLLECTIONS.budgets, userId);
  await setDoc(ref, { userId, recurring }, { merge: true });
}

// ---------------------------------------------------------------------------
// Meals, meal plan & shopping list
// ---------------------------------------------------------------------------
function mapMeal(snap: QueryDocumentSnapshot<DocumentData>): Meal {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name,
    slot: d.slot ?? "dinner",
    ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
    estCost: d.estCost ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getMeals(userId: string): Promise<Meal[]> {
  const q = query(
    collection(db, COLLECTIONS.meals),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapMeal)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type MealInput = Pick<Meal, "name" | "slot" | "ingredients" | "estCost">;

export async function createMeal(
  userId: string,
  input: MealInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.meals), {
    userId,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMeal(
  id: string,
  input: Partial<MealInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.meals, id), { ...input });
}

export async function deleteMeal(id: string): Promise<void> {
  // Cascade-delete this meal's plan entries so no orphans linger.
  const batch = writeBatch(db);
  const planSnap = await getDocs(
    query(collection(db, COLLECTIONS.mealPlan), where("mealId", "==", id))
  );
  planSnap.forEach((p) => batch.delete(p.ref));
  batch.delete(doc(db, COLLECTIONS.meals, id));
  await batch.commit();
}

function mapPlanEntry(snap: QueryDocumentSnapshot<DocumentData>): MealPlanEntry {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    date: d.date,
    slot: d.slot,
    mealId: d.mealId,
  };
}

/** All meal-plan entries for a user (filter by week client-side). */
export async function getMealPlan(userId: string): Promise<MealPlanEntry[]> {
  const q = query(
    collection(db, COLLECTIONS.mealPlan),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapPlanEntry);
}

/** Assign (or clear, when mealId is null) a meal for a date + slot. */
export async function setMealPlanEntry(
  userId: string,
  date: string,
  slot: MealSlot,
  mealId: string | null
): Promise<void> {
  const ref = doc(db, COLLECTIONS.mealPlan, `${userId}_${date}_${slot}`);
  if (mealId) {
    await setDoc(ref, { userId, date, slot, mealId });
  } else {
    await deleteDoc(ref);
  }
}

export async function getShoppingCheck(
  userId: string,
  weekStart: string
): Promise<ShoppingCheck | null> {
  const ref = doc(db, COLLECTIONS.shoppingChecks, `${userId}_${weekStart}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    userId: d.userId,
    weekStart: d.weekStart,
    checked: Array.isArray(d.checked) ? d.checked : [],
    extra: Array.isArray(d.extra) ? d.extra : [],
  };
}

export async function upsertShoppingCheck(
  userId: string,
  weekStart: string,
  input: { checked: string[]; extra: string[] }
): Promise<void> {
  const ref = doc(db, COLLECTIONS.shoppingChecks, `${userId}_${weekStart}`);
  await setDoc(ref, { userId, weekStart, ...input });
}

// ---------------------------------------------------------------------------
// Decision Eliminator (pre-decided defaults; one config doc per user)
// ---------------------------------------------------------------------------
export async function getDecisions(
  userId: string
): Promise<DecisionConfig | null> {
  const ref = doc(db, COLLECTIONS.decisions, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    userId: d.userId,
    outfits: d.outfits ?? {},
    defaults: Array.isArray(d.defaults) ? d.defaults : [],
  };
}

export type DecisionInput = Pick<DecisionConfig, "outfits" | "defaults">;

export async function upsertDecisions(
  userId: string,
  input: DecisionInput
): Promise<void> {
  const ref = doc(db, COLLECTIONS.decisions, userId);
  // Full replace so cleared outfits/defaults don't linger via deep merge.
  await setDoc(ref, { userId, ...input });
}

// ---------------------------------------------------------------------------
// Custom trackers & their daily logs
// ---------------------------------------------------------------------------
function mapTracker(snap: QueryDocumentSnapshot<DocumentData>): Tracker {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name,
    type: d.type ?? "number",
    unit: d.unit ?? null,
    target: d.target ?? null,
    icon: d.icon ?? "activity",
    sortOrder: d.sortOrder ?? 0,
    archived: d.archived ?? false,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getTrackers(userId: string): Promise<Tracker[]> {
  const q = query(
    collection(db, COLLECTIONS.trackers),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapTracker)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export type TrackerInput = Pick<
  Tracker,
  "name" | "type" | "unit" | "target" | "icon"
>;

export async function createTracker(
  userId: string,
  input: TrackerInput,
  sortOrder: number
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.trackers), {
    userId,
    ...input,
    sortOrder,
    archived: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTracker(
  id: string,
  input: Partial<TrackerInput & Pick<Tracker, "sortOrder" | "archived">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.trackers, id), { ...input });
}

export async function deleteTracker(id: string): Promise<void> {
  // Cascade-delete the tracker's logs.
  const batch = writeBatch(db);
  const logSnap = await getDocs(
    query(collection(db, COLLECTIONS.trackerLogs), where("trackerId", "==", id))
  );
  logSnap.forEach((l) => batch.delete(l.ref));
  batch.delete(doc(db, COLLECTIONS.trackers, id));
  await batch.commit();
}

function mapTrackerLog(snap: QueryDocumentSnapshot<DocumentData>): TrackerLog {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    trackerId: d.trackerId,
    date: d.date,
    value: d.value ?? 0,
  };
}

export async function getTrackerLogs(userId: string): Promise<TrackerLog[]> {
  const q = query(
    collection(db, COLLECTIONS.trackerLogs),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapTrackerLog);
}

/** Set (or clear, with null) a tracker's value for a day. Idempotent per day. */
export async function setTrackerLog(
  userId: string,
  trackerId: string,
  date: string,
  value: number | null
): Promise<void> {
  const ref = doc(db, COLLECTIONS.trackerLogs, `${userId}_${trackerId}_${date}`);
  if (value == null) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { userId, trackerId, date, value });
  }
}

// ---------------------------------------------------------------------------
// Wardrobe (clothing items with inline compressed thumbnails)
// ---------------------------------------------------------------------------
function mapClothing(snap: QueryDocumentSnapshot<DocumentData>): ClothingItem {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name,
    tags: Array.isArray(d.tags) ? d.tags : [],
    imageData: d.imageData ?? null,
    cost: d.cost ?? null,
    timesWorn: d.timesWorn ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getClothing(userId: string): Promise<ClothingItem[]> {
  const q = query(
    collection(db, COLLECTIONS.clothing),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapClothing).sort((a, b) => a.createdAt - b.createdAt);
}

export type ClothingInput = Pick<
  ClothingItem,
  "name" | "tags" | "imageData" | "cost" | "timesWorn"
>;

export async function createClothing(
  userId: string,
  input: ClothingInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.clothing), {
    userId,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClothing(
  id: string,
  input: Partial<ClothingInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.clothing, id), { ...input });
}

export async function deleteClothing(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.clothing, id));
}

// ---------------------------------------------------------------------------
// User preferences (one doc per user)
// ---------------------------------------------------------------------------
export async function getPrefs(userId: string): Promise<UserPrefs> {
  const ref = doc(db, COLLECTIONS.prefs, userId);
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  return {
    userId,
    waterUnit: d.waterUnit ?? "glasses",
    hiddenTrackers: Array.isArray(d.hiddenTrackers) ? d.hiddenTrackers : [],
    sleepTarget: d.sleepTarget ?? 8,
    reviewScale: d.reviewScale === 10 ? 10 : 100,
  };
}

export async function upsertPrefs(
  userId: string,
  input: Partial<
    Pick<UserPrefs, "waterUnit" | "hiddenTrackers" | "sleepTarget" | "reviewScale">
  >
): Promise<void> {
  const ref = doc(db, COLLECTIONS.prefs, userId);
  await setDoc(ref, { userId, ...input }, { merge: true });
}

/** Update just the display currency (stored on the budget doc as a code). */
export async function setCurrency(userId: string, code: string): Promise<void> {
  const existing = await getBudget(userId);
  await upsertBudget(userId, {
    currency: code,
    monthlyTotal: existing?.monthlyTotal ?? null,
    byCategory: existing?.byCategory ?? {},
    openingBalances: existing?.openingBalances ?? {},
    savingsGoal: existing?.savingsGoal ?? null,
  });
}
