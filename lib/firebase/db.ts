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
  increment,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { normalizeRecurringRule } from "@/lib/recurring";
import { entryGrams } from "@/lib/food";
import {
  estimateDocBytes,
  collectionLabel,
  isProtectedCollection,
  type CollectionUsage,
  type UsageScan,
} from "@/lib/storage";
import {
  COLLECTIONS,
  type AIProviders,
  type Budget,
  type ChatMessage,
  type ClothingItem,
  type HubAgent,
  type HubAutomation,
  type HubNotification,
  type NotificationTemplate,
  type NotifLogEntry,
  type DecisionConfig,
  type Expense,
  type Goal,
  type Habit,
  type HabitLog,
  type Meal,
  type MealPlanEntry,
  type MealSlot,
  type NutritionLog,
  type NutritionMeal,
  type MealFoodEntry,
  type FoodItem,
  type FoodServing,
  type PantryItem,
  type ShoppingItem,
  type Recipe,
  type Outfit,
  type PackingList,
  type Project,
  type RecurringRule,
  type Session,
  type ShoppingCheck,
  type SleepLog,
  type SleepMeta,
  type SleepRoutine,
  type TelegramConfig,
  type StorageConfig,
  type Task,
  type Tracker,
  type TrackerLog,
  type UserPrefs,
  type WardrobeStatus,
  type WearLog,
  type WeeklyReview,
} from "@/lib/types";
import { habitCurrentStreak, habitLongestStreak, isLogDone } from "@/lib/habits";
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
    emoji: d.emoji ?? null,
    tags: Array.isArray(d.tags) ? d.tags : [],
    frequency: d.frequency ?? "daily",
    category: d.category ?? null,
    color: d.color ?? null,
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : toMillis(d.createdAt),
    targetType: d.targetType ?? "check",
    targetValue: d.targetValue ?? null,
    difficulty:
      d.difficulty === "easy" || d.difficulty === "hard" || d.difficulty === "expert" ? d.difficulty : "medium",
    archived: d.archived === true,
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
    note: d.note ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export async function getHabits(userId: string): Promise<Habit[]> {
  const q = query(
    collection(db, COLLECTIONS.habits),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapHabit).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
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
  | "emoji"
  | "tags"
  | "frequency"
  | "category"
  | "color"
  | "targetType"
  | "targetValue"
  | "difficulty"
  | "archived"
>;

export async function createHabit(
  userId: string,
  input: HabitInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.habits), {
    userId,
    ...input,
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? "medium",
    archived: input.archived ?? false,
    sortOrder: Date.now(),
    streak: 0,
    bestStreak: 0,
    lastCompleted: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Set/clear a freeform note on a day's log (creates the log if needed). */
export async function setHabitLogNote(
  userId: string,
  habitId: string,
  date: string,
  note: string | null
): Promise<void> {
  const logRef = doc(db, COLLECTIONS.habitLogs, `${habitId}_${date}`);
  const existing = await getDoc(logRef);
  if (!existing.exists() && !note) return; // nothing to do
  await setDoc(
    logRef,
    {
      userId,
      habitId,
      completedDate: date,
      note: note || null,
      ...(existing.exists() ? {} : { value: null, createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function updateHabit(
  id: string,
  input: Partial<HabitInput> & { sortOrder?: number }
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.habits, id), { ...input });
}

export async function deleteHabit(userId: string, id: string): Promise<void> {
  const batch = writeBatch(db);
  // Query by userId (owner-scoped rules deny a query filtered only by habitId),
  // then filter to this habit's logs client-side.
  const logSnap = await getDocs(
    query(collection(db, COLLECTIONS.habitLogs), where("userId", "==", userId))
  );
  logSnap.forEach((l) => {
    if (l.data().habitId === id) batch.delete(l.ref);
  });
  batch.delete(doc(db, COLLECTIONS.habits, id));
  await batch.commit();
}

/**
 * Recompute a habit's streaks from its full log history, honoring completion
 * semantics: count/duration habits only count a day once the logged value
 * reaches the target. Queried by userId (owner-scoped rules reject a habitId-only
 * query) and filtered to this habit client-side.
 */
async function recomputeHabitStreaks(userId: string, habitId: string): Promise<void> {
  const habitRef = doc(db, COLLECTIONS.habits, habitId);
  const habitSnap = await getDoc(habitRef);
  if (!habitSnap.exists()) return;
  const habit = {
    targetType: habitSnap.data().targetType ?? "check",
    targetValue: habitSnap.data().targetValue ?? null,
    frequency: habitSnap.data().frequency ?? "daily",
  };

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.habitLogs), where("userId", "==", userId))
  );
  const dates = snap.docs
    .filter((d) => d.data().habitId === habitId && isLogDone(habit, { value: d.data().value ?? null }))
    .map((d) => d.data().completedDate as string);
  const today = toDateKey(new Date());
  const streak = habitCurrentStreak(habit, dates, today);
  const best = habitLongestStreak(habit, dates);
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
  await recomputeHabitStreaks(userId, habitId);
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
  await recomputeHabitStreaks(userId, habitId);
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
    kind: d.kind === "nap" ? "nap" : "sleep",
    bedtime: d.bedtime ?? null,
    wakeTime: d.wakeTime ?? null,
    hours: d.hours ?? 0,
    awakeMinutes: d.awakeMinutes ?? 0,
    quality: d.quality ?? 0,
    notes: d.notes ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapSleepMeta(snap: QueryDocumentSnapshot<DocumentData>): SleepMeta {
  const d = snap.data();
  return {
    date: d.date,
    eveningDone: Array.isArray(d.eveningDone) ? d.eveningDone : [],
    morningDone: Array.isArray(d.morningDone) ? d.morningDone : [],
    energy: typeof d.energy === "number" ? d.energy : null,
    mood: d.mood ?? null,
    stress: typeof d.stress === "number" ? d.stress : null,
    recoveryFeel: typeof d.recoveryFeel === "number" ? d.recoveryFeel : null,
    checkinNotes: d.checkinNotes ?? null,
  };
}

/** Every sleep doc (main sleeps + naps), newest date first — meta docs excluded. */
export async function getSleepEntries(userId: string): Promise<SleepLog[]> {
  const q = query(
    collection(db, COLLECTIONS.sleepLogs),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((ds) => ds.data().docType !== "meta")
    .map(mapSleepLog)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface SleepData {
  entries: SleepLog[]; // sleeps + naps, newest first
  metas: Record<string, SleepMeta>; // by date
}

/** One query for the whole sleep area: sleep/nap entries + per-day meta. */
export async function getSleepData(userId: string): Promise<SleepData> {
  const q = query(collection(db, COLLECTIONS.sleepLogs), where("userId", "==", userId));
  const snap = await getDocs(q);
  const entries: SleepLog[] = [];
  const metas: Record<string, SleepMeta> = {};
  for (const ds of snap.docs) {
    if (ds.data().docType === "meta") {
      const m = mapSleepMeta(ds);
      metas[m.date] = m;
    } else {
      entries.push(mapSleepLog(ds));
    }
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { entries, metas };
}

/** Merge-write a day's routine completion / morning check-in. */
export async function upsertSleepMeta(
  userId: string,
  date: string,
  patch: Partial<Pick<SleepMeta, "eveningDone" | "morningDone" | "energy" | "mood" | "stress" | "recoveryFeel" | "checkinNotes">>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.sleepLogs, `${userId}_meta_${date}`);
  const created = (await docExists(ref)) ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, { userId, date, docType: "meta", ...patch, ...created }, { merge: true });
}

/** Main night sleeps only (naps excluded) — the shape existing consumers expect. */
export async function getSleepLogs(userId: string): Promise<SleepLog[]> {
  return (await getSleepEntries(userId)).filter((l) => l.kind !== "nap");
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

export type SleepLogInput = Pick<SleepLog, "hours" | "quality" | "notes"> &
  Partial<Pick<SleepLog, "bedtime" | "wakeTime" | "awakeMinutes">>;

/** Upsert the main night sleep for a day (one per day; deterministic id). */
/** getDoc that treats a rules-denied read of a missing doc as "doesn't exist". */
async function docExists(ref: ReturnType<typeof doc>): Promise<boolean> {
  try {
    return (await getDoc(ref)).exists();
  } catch {
    return false; // owner-scoped rules deny reads of nonexistent docs
  }
}

export async function upsertSleepLog(
  userId: string,
  date: string,
  input: SleepLogInput
): Promise<void> {
  const ref = doc(db, COLLECTIONS.sleepLogs, `${userId}_${date}`);
  // Only stamp createdAt on first creation so merge-writes don't reset it.
  const created = (await docExists(ref)) ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, { userId, date, kind: "sleep", ...input, ...created }, { merge: true });
}

/** Add a nap for a day (auto id — a day can have several). */
export async function addNap(
  userId: string,
  date: string,
  input: SleepLogInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.sleepLogs), {
    userId,
    date,
    kind: "nap",
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Patch any sleep entry (main sleep or nap) by doc id. */
export async function updateSleepEntry(
  id: string,
  input: Partial<SleepLogInput & Pick<SleepLog, "date">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.sleepLogs, id), { ...input });
}

/** Delete any sleep entry by doc id (works for main sleeps and naps). */
export async function deleteSleepEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.sleepLogs, id));
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
    calories: typeof d.calories === "number" ? d.calories : null,
    protein: typeof d.protein === "number" ? d.protein : null,
    carbs: typeof d.carbs === "number" ? d.carbs : null,
    fat: typeof d.fat === "number" ? d.fat : null,
    cost: typeof d.cost === "number" ? d.cost : null,
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
    .filter((d) => { const t = d.data().docType; return t !== "meal" && t !== "food"; }) // per-day logs only
    .map(mapNutritionLog)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

const numOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

function mapMealEntry(e: Record<string, unknown>, i: number): MealFoodEntry {
  return {
    id: typeof e.id === "string" ? e.id : `e${i}`,
    foodId: typeof e.foodId === "string" ? e.foodId : "",
    name: typeof e.name === "string" ? e.name : "Food",
    unit: e.unit === "ml" ? "ml" : "g",
    quantity: typeof e.quantity === "number" ? e.quantity : 1,
    servingLabel: typeof e.servingLabel === "string" ? e.servingLabel : "",
    servingGrams: typeof e.servingGrams === "number" ? e.servingGrams : 100,
    sortOrder: typeof e.sortOrder === "number" ? e.sortOrder : i,
  };
}

function mapNutritionMeal(snap: QueryDocumentSnapshot<DocumentData>): NutritionMeal {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    date: d.date,
    name: d.name ?? "Meal",
    icon: d.icon ?? "🍽️",
    color: d.color ?? null,
    time: d.time ?? null,
    notes: d.notes ?? null,
    calories: numOrNull(d.calories),
    protein: numOrNull(d.protein),
    carbs: numOrNull(d.carbs),
    fat: numOrNull(d.fat),
    cost: numOrNull(d.cost),
    items: Array.isArray(d.items) ? d.items.map((e, i) => mapMealEntry(e as Record<string, unknown>, i)).sort((a, b) => a.sortOrder - b.sortOrder) : [],
    sortOrder: d.sortOrder ?? 0,
    collapsed: d.collapsed === true,
    createdAt: toMillis(d.createdAt),
  };
}

function mapFood(snap: QueryDocumentSnapshot<DocumentData>): FoodItem {
  const d = snap.data();
  const servings: FoodServing[] = Array.isArray(d.servings)
    ? d.servings.map((s: Record<string, unknown>, i: number) => ({
        id: typeof s.id === "string" ? s.id : `s${i}`,
        label: typeof s.label === "string" ? s.label : "",
        grams: typeof s.grams === "number" ? s.grams : 0,
      }))
    : [];
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? "Food",
    imageData: d.imageData ?? null,
    category: d.category ?? null,
    brand: d.brand ?? null,
    notes: d.notes ?? null,
    unit: d.unit === "ml" ? "ml" : "g",
    calories: numOrNull(d.calories),
    protein: numOrNull(d.protein),
    carbs: numOrNull(d.carbs),
    fat: numOrNull(d.fat),
    purchasePrice: numOrNull(d.purchasePrice),
    quantityPurchased: numOrNull(d.quantityPurchased),
    currency: d.currency ?? null,
    servings,
    favorite: d.favorite === true,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    archived: d.archived === true,
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

export interface NutritionDay {
  log: NutritionLog | null;
  meals: NutritionMeal[];
  foods: FoodItem[];
}

/** One query for the Workspace: the day's water/summary doc + its meals + the
 * whole (non-archived-aware) Food Library, all from `nutritionLogs`. */
export async function getNutritionDay(userId: string, date: string): Promise<NutritionDay> {
  const q = query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId));
  const snap = await getDocs(q);
  let log: NutritionLog | null = null;
  const meals: NutritionMeal[] = [];
  const foods: FoodItem[] = [];
  for (const ds of snap.docs) {
    const d = ds.data();
    if (d.docType === "meal") {
      if (d.date === date) meals.push(mapNutritionMeal(ds));
    } else if (d.docType === "food") {
      foods.push(mapFood(ds));
    } else if (ds.id === `${userId}_${date}`) {
      log = mapNutritionLog(ds);
    }
  }
  meals.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  foods.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  return { log, meals, foods };
}

export type NutritionMealInput = Pick<NutritionMeal, "name" | "icon" | "color" | "time" | "notes" | "calories" | "protein" | "carbs" | "fat" | "cost" | "items"> &
  Partial<Pick<NutritionMeal, "sortOrder" | "collapsed">>;

export async function createNutritionMeal(userId: string, date: string, input: NutritionMealInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.nutritionLogs), {
    userId,
    docType: "meal",
    date,
    sortOrder: 0,
    collapsed: false,
    ...input,
    createdAt: serverTimestamp(),
  });
  if (input.items?.length) await applyPantryConsumption(userId, consumptionMap(input.items));
  return ref.id;
}

export async function updateNutritionMeal(id: string, input: Partial<NutritionMealInput>): Promise<void> {
  const ref = doc(db, COLLECTIONS.nutritionLogs, id);
  // Only reconcile the pantry when the food list actually changed.
  if (input.items !== undefined) {
    const before = await getDoc(ref);
    const d = before.data();
    const oldItems: MealFoodEntry[] = before.exists() && Array.isArray(d?.items) ? d!.items.map((e: Record<string, unknown>, i: number) => mapMealEntry(e, i)) : [];
    await updateDoc(ref, { ...input });
    if (d?.userId) await applyPantryConsumption(d.userId as string, deltaConsumption(oldItems, input.items));
  } else {
    await updateDoc(ref, { ...input });
  }
}

export async function deleteNutritionMeal(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.nutritionLogs, id);
  const before = await getDoc(ref);
  const d = before.data();
  const oldItems: MealFoodEntry[] = before.exists() && Array.isArray(d?.items) ? d!.items.map((e: Record<string, unknown>, i: number) => mapMealEntry(e, i)) : [];
  await deleteDoc(ref);
  if (d?.userId && oldItems.length) await applyPantryConsumption(d.userId as string, negateMap(consumptionMap(oldItems)));
}

/** Persist a new order (sortOrder = position) after a drag reorder. */
export async function reorderNutritionMeals(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, COLLECTIONS.nutritionLogs, id), { sortOrder: i }));
  await batch.commit();
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
  | "protein"
  | "carbs"
  | "fat"
  | "cost"
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
// Food Library — reusable foods (docType "food" in the nutritionLogs collection)
// ---------------------------------------------------------------------------
export type FoodInput = Pick<
  FoodItem,
  | "name" | "imageData" | "category" | "brand" | "notes" | "unit"
  | "calories" | "protein" | "carbs" | "fat"
  | "purchasePrice" | "quantityPurchased" | "currency"
  | "servings" | "tags"
> &
  Partial<Pick<FoodItem, "favorite" | "archived" | "sortOrder">>;

/** All foods in the user's library (both active and archived). */
export async function getFoods(userId: string): Promise<FoodItem[]> {
  const q = query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.data().docType === "food")
    .map(mapFood)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createFood(userId: string, input: FoodInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.nutritionLogs), {
    userId,
    docType: "food",
    favorite: false,
    archived: false,
    sortOrder: 0,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFood(id: string, input: Partial<FoodInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { ...input });
}

export async function deleteFood(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.nutritionLogs, id));
}

export async function setFoodFavorite(id: string, favorite: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { favorite });
}

export async function setFoodArchived(id: string, archived: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { archived });
}

/** Persist custom order (sortOrder = position) after a drag reorder. */
export async function reorderFoods(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, COLLECTIONS.nutritionLogs, id), { sortOrder: i }));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Pantry — lots of food on hand (docType "pantry"), auto-decremented by meals
// ---------------------------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;

/** grams consumed per foodId across a set of meal/recipe entries. */
function consumptionMap(items: MealFoodEntry[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of items) {
    if (!e.foodId) continue;
    m[e.foodId] = (m[e.foodId] ?? 0) + entryGrams(e);
  }
  return m;
}
function deltaConsumption(oldItems: MealFoodEntry[], newItems: MealFoodEntry[]): Record<string, number> {
  const o = consumptionMap(oldItems);
  const n = consumptionMap(newItems);
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) out[k] = (n[k] ?? 0) - (o[k] ?? 0);
  return out;
}
function negateMap(m: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) out[k] = -v;
  return out;
}

function mapPantry(snap: QueryDocumentSnapshot<DocumentData>): PantryItem {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    foodId: d.foodId ?? null,
    name: d.name ?? "Item",
    unit: d.unit === "ml" ? "ml" : "g",
    quantity: numOrNull(d.quantity),
    quantityRemaining: typeof d.quantityRemaining === "number" ? d.quantityRemaining : 0,
    purchaseDate: d.purchaseDate ?? null,
    expirationDate: d.expirationDate ?? null,
    purchasePrice: numOrNull(d.purchasePrice),
    lowThreshold: numOrNull(d.lowThreshold),
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

/** Earliest-expiring, then earliest-purchased first (FEFO) — reduce waste. */
function fefo(a: PantryItem, b: PantryItem): number {
  const ax = a.expirationDate ?? "9999-12-31";
  const bx = b.expirationDate ?? "9999-12-31";
  if (ax !== bx) return ax < bx ? -1 : 1;
  const ap = a.purchaseDate ?? "9999-12-31";
  const bp = b.purchaseDate ?? "9999-12-31";
  return ap < bp ? -1 : ap > bp ? 1 : a.createdAt - b.createdAt;
}

/**
 * Apply a consumption delta (grams per foodId; positive = used, negative =
 * restocked) to the pantry. Positive amounts are drawn FEFO across lots and
 * clamped at 0; negative amounts are returned to the earliest-expiring lot.
 * Best-effort: foods with no matching lot are ignored. Never throws.
 */
export async function applyPantryConsumption(userId: string, delta: Record<string, number>): Promise<void> {
  const entries = Object.entries(delta).filter(([, g]) => g);
  if (!entries.length) return;
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId)));
    const lots = snap.docs.filter((x) => x.data().docType === "pantry").map(mapPantry);
    const batch = writeBatch(db);
    let touched = 0;
    for (const [foodId, grams] of entries) {
      const foodLots = lots.filter((l) => l.foodId === foodId).sort(fefo);
      if (!foodLots.length) continue;
      if (grams > 0) {
        let need = grams;
        for (const lot of foodLots) {
          if (need <= 0) break;
          const take = Math.min(lot.quantityRemaining, need);
          if (take > 0) {
            batch.update(doc(db, COLLECTIONS.nutritionLogs, lot.id), { quantityRemaining: round2(lot.quantityRemaining - take) });
            need -= take;
            touched++;
          }
        }
      } else {
        const lot = foodLots[0];
        batch.update(doc(db, COLLECTIONS.nutritionLogs, lot.id), { quantityRemaining: round2(lot.quantityRemaining - grams) });
        touched++;
      }
    }
    if (touched) await batch.commit();
  } catch {
    /* pantry sync is best-effort; never block a meal save */
  }
}

export type PantryInput = Pick<PantryItem, "foodId" | "name" | "unit" | "quantity" | "quantityRemaining" | "purchaseDate" | "expirationDate" | "purchasePrice" | "lowThreshold"> &
  Partial<Pick<PantryItem, "sortOrder">>;

export async function getPantry(userId: string): Promise<PantryItem[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId)));
  return snap.docs.filter((d) => d.data().docType === "pantry").map(mapPantry).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createPantryItem(userId: string, input: PantryInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.nutritionLogs), { userId, docType: "pantry", sortOrder: 0, ...input, createdAt: serverTimestamp() });
  return ref.id;
}
export async function updatePantryItem(id: string, input: Partial<PantryInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { ...input });
}
export async function deletePantryItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.nutritionLogs, id));
}
export async function reorderPantry(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, COLLECTIONS.nutritionLogs, id), { sortOrder: i }));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Shopping list (docType "shopping")
// ---------------------------------------------------------------------------
function mapShopping(snap: QueryDocumentSnapshot<DocumentData>): ShoppingItem {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    foodId: d.foodId ?? null,
    name: d.name ?? "Item",
    unit: d.unit === "ml" ? "ml" : d.unit === "g" ? "g" : null,
    quantity: numOrNull(d.quantity),
    estCost: numOrNull(d.estCost),
    purchased: d.purchased === true,
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

export type ShoppingInput = Pick<ShoppingItem, "foodId" | "name" | "unit" | "quantity" | "estCost"> &
  Partial<Pick<ShoppingItem, "purchased" | "sortOrder">>;

export async function getShopping(userId: string): Promise<ShoppingItem[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId)));
  return snap.docs.filter((d) => d.data().docType === "shopping").map(mapShopping).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createShoppingItem(userId: string, input: ShoppingInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.nutritionLogs), { userId, docType: "shopping", purchased: false, sortOrder: 0, ...input, createdAt: serverTimestamp() });
  return ref.id;
}
export async function updateShoppingItem(id: string, input: Partial<ShoppingInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { ...input });
}
export async function deleteShoppingItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.nutritionLogs, id));
}
export async function reorderShopping(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, COLLECTIONS.nutritionLogs, id), { sortOrder: i }));
  await batch.commit();
}
export async function clearPurchasedShopping(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COLLECTIONS.nutritionLogs, id)));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Recipes & meal templates (docType "recipe")
// ---------------------------------------------------------------------------
function mapRecipe(snap: QueryDocumentSnapshot<DocumentData>): Recipe {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    kind: d.kind === "template" ? "template" : "recipe",
    name: d.name ?? "Recipe",
    imageData: d.imageData ?? null,
    notes: d.notes ?? null,
    items: Array.isArray(d.items) ? d.items.map((e, i) => mapMealEntry(e as Record<string, unknown>, i)).sort((a, b) => a.sortOrder - b.sortOrder) : [],
    collection: d.collection ?? null,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    favorite: d.favorite === true,
    archived: d.archived === true,
    sortOrder: d.sortOrder ?? 0,
    createdAt: toMillis(d.createdAt),
  };
}

export type RecipeInput = Pick<Recipe, "kind" | "name" | "imageData" | "notes" | "items" | "collection" | "tags"> &
  Partial<Pick<Recipe, "favorite" | "archived" | "sortOrder">>;

export async function getRecipes(userId: string): Promise<Recipe[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId)));
  return snap.docs.filter((d) => d.data().docType === "recipe").map(mapRecipe).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.nutritionLogs), { userId, docType: "recipe", favorite: false, archived: false, sortOrder: 0, ...input, createdAt: serverTimestamp() });
  return ref.id;
}
export async function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.nutritionLogs, id), { ...input });
}
export async function deleteRecipe(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.nutritionLogs, id));
}
export async function reorderRecipes(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, COLLECTIONS.nutritionLogs, id), { sortOrder: i }));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// One-shot loader for cross-feature pages (analytics, shopping-from-pantry)
// ---------------------------------------------------------------------------
export interface NutritionAll {
  logs: NutritionLog[];
  meals: NutritionMeal[];
  foods: FoodItem[];
  pantry: PantryItem[];
  shopping: ShoppingItem[];
  recipes: Recipe[];
}

/** Load the entire nutrition dataset in a single query (all docTypes at once). */
export async function getNutritionAll(userId: string): Promise<NutritionAll> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.nutritionLogs), where("userId", "==", userId)));
  const all: NutritionAll = { logs: [], meals: [], foods: [], pantry: [], shopping: [], recipes: [] };
  for (const ds of snap.docs) {
    const t = ds.data().docType;
    if (t === "meal") all.meals.push(mapNutritionMeal(ds));
    else if (t === "food") all.foods.push(mapFood(ds));
    else if (t === "pantry") all.pantry.push(mapPantry(ds));
    else if (t === "shopping") all.shopping.push(mapShopping(ds));
    else if (t === "recipe") all.recipes.push(mapRecipe(ds));
    else all.logs.push(mapNutritionLog(ds));
  }
  all.meals.sort((a, b) => (a.date < b.date ? 1 : -1) || a.sortOrder - b.sortOrder);
  all.foods.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  all.pantry.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  all.shopping.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  all.recipes.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  return all;
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

/** Delete many expense entries at once. Chunked to respect the 500-op batch cap. */
export async function deleteExpenses(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) {
      batch.delete(doc(db, COLLECTIONS.expenses, id));
    }
    await batch.commit();
  }
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
    recurring: Array.isArray(d.recurring) ? d.recurring.map(normalizeRecurringRule) : [],
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
// Wardrobe (clothing items, outfits & wear logs)
//
// Everything lives in the existing `clothing` collection — its owner-scoped
// security rules are already deployed, and new rules can't be pushed from this
// environment. Docs are discriminated by `docType`: items (missing docType or
// "item"), outfits ("outfit"), and daily wear logs ("wear"). Photos are inline
// compressed data URLs on the item doc itself.
// ---------------------------------------------------------------------------
function mapClothing(snap: QueryDocumentSnapshot<DocumentData>): ClothingItem {
  const d = snap.data();
  const validStatus = ["clean", "worn", "dirty", "washing", "drying", "ready"];
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name,
    tags: Array.isArray(d.tags) ? d.tags : [],
    imageData: d.imageData ?? null,
    extraImages: Array.isArray(d.extraImages) ? d.extraImages : [],
    category: d.category ?? null,
    brand: d.brand ?? null,
    color: d.color ?? null,
    size: d.size ?? null,
    seasons: Array.isArray(d.seasons) ? d.seasons : [],
    styles: Array.isArray(d.styles) ? d.styles : [],
    purchaseDate: d.purchaseDate ?? null,
    cost: d.cost ?? null,
    status: validStatus.includes(d.status) ? d.status : "clean",
    needsIroning: d.needsIroning === true,
    favorite: d.favorite === true,
    notes: d.notes ?? null,
    care: d.care ?? null,
    retired: d.retired === true,
    timesWorn: d.timesWorn ?? 0,
    wearsSinceWash: d.wearsSinceWash ?? 0,
    lastWorn: d.lastWorn ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapOutfit(snap: QueryDocumentSnapshot<DocumentData>): Outfit {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? "Outfit",
    type: d.type === "template" ? "template" : "custom",
    itemIds: Array.isArray(d.itemIds) ? d.itemIds : [],
    occasions: Array.isArray(d.occasions) ? d.occasions : [],
    seasons: Array.isArray(d.seasons) ? d.seasons : [],
    rating: typeof d.rating === "number" ? d.rating : null,
    weatherFit: d.weatherFit ?? null,
    notes: d.notes ?? null,
    favorite: d.favorite === true,
    timesWorn: d.timesWorn ?? 0,
    lastWorn: d.lastWorn ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapWear(snap: QueryDocumentSnapshot<DocumentData>): WearLog {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    date: d.date,
    outfitId: d.outfitId ?? null,
    itemIds: Array.isArray(d.itemIds) ? d.itemIds : [],
    planned: d.planned === true,
    createdAt: toMillis(d.createdAt),
  };
}

export interface WardrobeData {
  items: ClothingItem[];
  outfits: Outfit[];
  wears: WearLog[];
}

/** One query for the whole wardrobe area, split by docType client-side. */
export async function getWardrobe(userId: string): Promise<WardrobeData> {
  const q = query(
    collection(db, COLLECTIONS.clothing),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const items: ClothingItem[] = [];
  const outfits: Outfit[] = [];
  const wears: WearLog[] = [];
  for (const docSnap of snap.docs) {
    const t = docSnap.data().docType;
    if (t === "outfit") outfits.push(mapOutfit(docSnap));
    else if (t === "wear") wears.push(mapWear(docSnap));
    else if (t == null || t === "item") items.push(mapClothing(docSnap)); // legacy items have no docType
    // any other docType (e.g. "packing") is intentionally ignored here
  }
  items.sort((a, b) => a.createdAt - b.createdAt);
  outfits.sort((a, b) => b.createdAt - a.createdAt);
  wears.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { items, outfits, wears };
}

export async function getClothing(userId: string): Promise<ClothingItem[]> {
  return (await getWardrobe(userId)).items;
}

export type ClothingInput = Pick<
  ClothingItem,
  "name" | "tags" | "imageData" | "cost"
> &
  Partial<
    Pick<
      ClothingItem,
      | "extraImages"
      | "category"
      | "brand"
      | "color"
      | "size"
      | "seasons"
      | "styles"
      | "purchaseDate"
      | "status"
      | "needsIroning"
      | "favorite"
      | "notes"
      | "care"
      | "retired"
      | "lastWorn"
      // Optional: the wear counter is normally managed by wearing an item, not by
      // the edit form. The legacy Routines form still exposes it as a manual field.
      | "timesWorn"
    >
  >;

export async function createClothing(
  userId: string,
  input: ClothingInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.clothing), {
    userId,
    docType: "item",
    extraImages: [],
    category: null,
    brand: null,
    color: null,
    size: null,
    seasons: [],
    styles: [],
    purchaseDate: null,
    status: "clean",
    needsIroning: false,
    favorite: false,
    notes: null,
    care: null,
    retired: false,
    lastWorn: null,
    timesWorn: 0,
    wearsSinceWash: 0,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Fresh-from-laundry statuses that reset the wears-since-wash counter. */
const FRESH_STATUSES = new Set<WardrobeStatus>(["clean", "ready", "washing", "drying"]);

export async function updateClothing(
  id: string,
  input: Partial<ClothingInput>
): Promise<void> {
  // Laundering an item resets its freshness counter.
  const reset = input.status && FRESH_STATUSES.has(input.status) ? { wearsSinceWash: 0 } : {};
  await updateDoc(doc(db, COLLECTIONS.clothing, id), { ...input, ...reset });
}

export async function deleteClothing(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.clothing, id));
}

/**
 * Quick single-item wear (legacy Routines widget): bump the counter atomically
 * and mark the item worn so it stays consistent with laundry / recently-worn.
 * Does not touch the day's outfit wear log — use setWearForDay for full outfits.
 */
export async function bumpItemWear(itemId: string, date: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.clothing, itemId), {
    timesWorn: increment(1),
    wearsSinceWash: increment(1),
    lastWorn: date,
    status: "worn",
  });
}

/** Bulk status change — laundry is a batch activity (chunked under 500 ops). */
export async function bulkUpdateClothingStatus(
  ids: string[],
  patch: { status?: WardrobeStatus; needsIroning?: boolean }
): Promise<void> {
  const reset = patch.status && FRESH_STATUSES.has(patch.status) ? { wearsSinceWash: 0 } : {};
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) {
      batch.update(doc(db, COLLECTIONS.clothing, id), { ...patch, ...reset });
    }
    await batch.commit();
  }
}

// --- Outfits -----------------------------------------------------------------
export type OutfitInput = Pick<
  Outfit,
  "name" | "type" | "itemIds" | "occasions" | "rating" | "weatherFit" | "notes" | "favorite"
> &
  Partial<Pick<Outfit, "seasons">>;

export async function createOutfit(userId: string, input: OutfitInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.clothing), {
    userId,
    docType: "outfit",
    timesWorn: 0,
    lastWorn: null,
    seasons: [],
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOutfit(id: string, input: Partial<OutfitInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.clothing, id), { ...input });
}

export async function deleteOutfit(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.clothing, id));
}

// --- Wear log ----------------------------------------------------------------
/**
 * Remove a day's wear log. If it was a confirmed wear, its counters are rolled
 * back (pass the items/outfit it recorded); planned days just delete. One batch.
 */
export async function removeWearDay(input: {
  userId: string;
  date: string;
  prevItems: Pick<ClothingItem, "id" | "timesWorn">[];
  prevOutfit: Pick<Outfit, "id" | "timesWorn"> | null;
}): Promise<void> {
  const { userId, date, prevItems, prevOutfit } = input;
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.clothing, `wear_${userId}_${date}`));
  for (const it of prevItems) {
    batch.update(doc(db, COLLECTIONS.clothing, it.id), { timesWorn: increment(-1) });
  }
  if (prevOutfit) {
    batch.update(doc(db, COLLECTIONS.clothing, prevOutfit.id), { timesWorn: increment(-1) });
  }
  await batch.commit();
}

/** Keep lastWorn as the most recent date (so retro-logging an old day never moves it backward). */
function laterDate(a: string | null, b: string): string {
  return a && a > b ? a : b;
}

/** What kind of wear a date represents relative to today. */
export type WearKind = "confirm" | "plan" | "log";

/**
 * Single reconciling write path for a day's outfit. Diffs the new selection
 * against whatever was previously logged for that date, so re-saving or editing
 * a day never double-counts `timesWorn`. One batch.
 *
 * - "confirm" (today): planned=false, +1 wear on added items, status → "worn".
 * - "log" (a past day): planned=false, +1 wear on added items, status untouched,
 *   lastWorn only advances (never rewinds to the older date).
 * - "plan" (a future day): planned=true, no counter changes; if the day was
 *   previously a confirmed wear, its counters are rolled back.
 */
export async function setWearForDay(input: {
  userId: string;
  date: string;
  kind: WearKind;
  /** Items selected now (full objects — need current timesWorn/lastWorn). */
  chosen: Pick<ClothingItem, "id" | "timesWorn" | "lastWorn">[];
  outfit: Pick<Outfit, "id" | "timesWorn" | "lastWorn"> | null;
  /** Items/outfit from the day's PRIOR CONFIRMED log ([]/null if none or it was only planned). */
  prevItems: Pick<ClothingItem, "id" | "timesWorn">[];
  prevOutfit: Pick<Outfit, "id" | "timesWorn"> | null;
}): Promise<void> {
  // Counters use Firestore increment() so concurrent writers can't clobber each
  // other; the diff logic below only decides WHICH docs move, never the value.
  const { userId, date, kind, chosen, outfit, prevItems, prevOutfit } = input;
  const planned = kind === "plan";
  const markWorn = kind === "confirm";
  const batch = writeBatch(db);

  batch.set(doc(db, COLLECTIONS.clothing, `wear_${userId}_${date}`), {
    userId,
    docType: "wear",
    date,
    itemIds: chosen.map((i) => i.id),
    outfitId: outfit?.id ?? null,
    planned,
    createdAt: serverTimestamp(),
  });

  const prevIds = new Set(prevItems.map((i) => i.id));
  const newIds = new Set(chosen.map((i) => i.id));

  if (!planned) {
    // Added items: +1 wear (and status/lastWorn where appropriate).
    for (const it of chosen) {
      if (prevIds.has(it.id)) {
        if (markWorn) batch.update(doc(db, COLLECTIONS.clothing, it.id), { status: "worn", lastWorn: date });
        continue;
      }
      const patch: Record<string, unknown> = { timesWorn: increment(1), lastWorn: laterDate(it.lastWorn, date) };
      // "confirm" (today) advances freshness + marks worn; a retro "log" only counts the wear.
      if (markWorn) {
        patch.status = "worn";
        patch.wearsSinceWash = increment(1);
      }
      batch.update(doc(db, COLLECTIONS.clothing, it.id), patch);
    }
  }
  // Removed items (present in the prior confirmed log, gone now): −1 wear.
  for (const it of prevItems) {
    if (newIds.has(it.id) && !planned) continue;
    batch.update(doc(db, COLLECTIONS.clothing, it.id), { timesWorn: increment(-1) });
  }

  // Outfit counters — only move when the linked outfit actually changed.
  const prevOid = prevOutfit?.id ?? null;
  const newOid = planned ? null : outfit?.id ?? null;
  if (prevOid && prevOid !== newOid) {
    batch.update(doc(db, COLLECTIONS.clothing, prevOutfit!.id), { timesWorn: increment(-1) });
  }
  if (newOid && newOid !== prevOid && outfit) {
    batch.update(doc(db, COLLECTIONS.clothing, outfit.id), { timesWorn: increment(1), lastWorn: laterDate(outfit.lastWorn, date) });
  }

  await batch.commit();
}

// --- Packing lists -----------------------------------------------------------
// Stored in the `clothing` collection (docType "packing") so no new security
// rules are needed; getWardrobe ignores them.
function mapPacking(snap: QueryDocumentSnapshot<DocumentData>): PackingList {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? "Trip",
    days: typeof d.days === "number" ? d.days : null,
    itemIds: Array.isArray(d.itemIds) ? d.itemIds : [],
    packed: Array.isArray(d.packed) ? d.packed : [],
    createdAt: toMillis(d.createdAt),
  };
}

export async function getPackingLists(userId: string): Promise<PackingList[]> {
  const q = query(collection(db, COLLECTIONS.clothing), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.data().docType === "packing")
    .map(mapPacking)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createPackingList(
  userId: string,
  input: { name: string; days: number | null; itemIds: string[] }
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.clothing), {
    userId,
    docType: "packing",
    packed: [],
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePackingList(
  id: string,
  input: Partial<Pick<PackingList, "name" | "days" | "itemIds" | "packed">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.clothing, id), { ...input });
}

export async function deletePackingList(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.clothing, id));
}

// ---------------------------------------------------------------------------
// Agent Hub (agents, automations, notifications, conversations)
//
// Stored in the existing `decisions` collection, discriminated by `docType` —
// that collection is only ever read by direct doc id (the DecisionConfig doc),
// so hub docs are invisible to existing code and reuse its deployed rules.
// ---------------------------------------------------------------------------
function mapHubAgent(snap: QueryDocumentSnapshot<DocumentData>): HubAgent {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? "Agent",
    icon: d.icon ?? "🤖",
    module: d.module ?? "general",
    provider: d.provider === "gemini" ? "gemini" : "anthropic",
    model: d.model ?? "",
    systemPrompt: d.systemPrompt ?? "",
    createdAt: toMillis(d.createdAt),
  };
}

function mapAutomation(snap: QueryDocumentSnapshot<DocumentData>): HubAutomation {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? "Rule",
    metric: d.metric ?? "dirtyCount",
    operator: [">=", "<=", ">", "<", "=="].includes(d.operator) ? d.operator : ">=",
    value: typeof d.value === "number" ? d.value : 0,
    action: d.action === "attention" ? "attention" : "notify",
    telegram: d.telegram === true,
    message: d.message ?? "",
    enabled: d.enabled !== false,
    lastFired: d.lastFired ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapHubNotification(snap: QueryDocumentSnapshot<DocumentData>): HubNotification {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    source: d.source === "system" ? "system" : "automation",
    title: d.title ?? "",
    body: d.body ?? "",
    href: d.href ?? null,
    read: d.read === true,
    createdAt: toMillis(d.createdAt),
  };
}

export interface HubDocs {
  agents: HubAgent[];
  automations: HubAutomation[];
  notifications: HubNotification[];
}

/** One query for all hub docs, split by docType client-side. */
export async function getHubDocs(userId: string): Promise<HubDocs> {
  const q = query(collection(db, COLLECTIONS.decisions), where("userId", "==", userId));
  const snap = await getDocs(q);
  const agents: HubAgent[] = [];
  const automations: HubAutomation[] = [];
  const notifications: HubNotification[] = [];
  for (const ds of snap.docs) {
    const t = ds.data().docType;
    if (t === "agent") agents.push(mapHubAgent(ds));
    else if (t === "automation") automations.push(mapAutomation(ds));
    else if (t === "notification") notifications.push(mapHubNotification(ds));
    // anything else (the DecisionConfig doc, conversations) is ignored here
  }
  agents.sort((a, b) => a.createdAt - b.createdAt);
  automations.sort((a, b) => a.createdAt - b.createdAt);
  notifications.sort((a, b) => b.createdAt - a.createdAt);
  return { agents, automations, notifications };
}

export type HubAgentInput = Pick<HubAgent, "name" | "icon" | "module" | "provider" | "model" | "systemPrompt">;

export async function createHubAgent(userId: string, input: HubAgentInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.decisions), {
    userId,
    docType: "agent",
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateHubAgent(id: string, input: Partial<HubAgentInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.decisions, id), { ...input });
}

export async function deleteHubAgent(userId: string, id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.decisions, id));
  batch.delete(doc(db, COLLECTIONS.decisions, `hub_conv_${userId}_${id}`));
  await batch.commit();
}

export type AutomationInput = Pick<HubAutomation, "name" | "metric" | "operator" | "value" | "action" | "telegram" | "message" | "enabled">;

export async function createAutomation(userId: string, input: AutomationInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.decisions), {
    userId,
    docType: "automation",
    lastFired: null,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAutomation(id: string, input: Partial<AutomationInput & Pick<HubAutomation, "lastFired">>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.decisions, id), { ...input });
}

export async function deleteAutomation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.decisions, id));
}

export async function addHubNotification(
  userId: string,
  input: Pick<HubNotification, "source" | "title" | "body" | "href">
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.decisions), {
    userId,
    docType: "notification",
    read: false,
    ...input,
    createdAt: serverTimestamp(),
  });
}

export async function setNotificationRead(id: string, read: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.decisions, id), { read });
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) batch.update(doc(db, COLLECTIONS.decisions, id), { read: true });
    await batch.commit();
  }
}

export async function clearNotifications(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) batch.delete(doc(db, COLLECTIONS.decisions, id));
    await batch.commit();
  }
}

/** Chat history for one agent (deterministic doc id; capped by the caller). */
export async function getConversation(userId: string, agentId: string): Promise<ChatMessage[]> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.decisions, `hub_conv_${userId}_${agentId}`));
    if (!snap.exists()) return [];
    const d = snap.data();
    return Array.isArray(d.messages) ? (d.messages as ChatMessage[]) : [];
  } catch {
    // Owner-scoped rules deny reads of NONEXISTENT docs (resource is null), so a
    // first-ever open lands here — treat it as an empty conversation.
    return [];
  }
}

export async function saveConversation(userId: string, agentId: string, messages: ChatMessage[]): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.decisions, `hub_conv_${userId}_${agentId}`), {
    userId,
    docType: "conversation",
    agentId,
    messages: messages.slice(-60), // keep the doc well under Firestore's 1MB
  });
}

// ---------------------------------------------------------------------------
// Notification builder templates + delivery log (also in `decisions`)
// ---------------------------------------------------------------------------
function mapNotifTemplate(snap: QueryDocumentSnapshot<DocumentData>): NotificationTemplate {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    eventType: d.eventType,
    enabled: d.enabled === true,
    body: d.body ?? "",
    mode: d.mode === "blocks" ? "blocks" : "text",
    blocks: Array.isArray(d.blocks) ? d.blocks : [],
    buttons: Array.isArray(d.buttons) ? d.buttons : [],
    condition: d.condition ?? { timeMode: "absolute", reference: "wake_time", offsetMin: 0, time: "", days: "all", states: [] },
    stylePreset: d.stylePreset ?? "Custom",
    lastFired: d.lastFired ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

function mapNotifLog(snap: QueryDocumentSnapshot<DocumentData>): NotifLogEntry {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    eventType: d.eventType ?? "",
    body: d.body ?? "",
    status: d.status === "failed" ? "failed" : "delivered",
    createdAt: toMillis(d.createdAt),
  };
}

export async function getNotifTemplates(userId: string): Promise<NotificationTemplate[]> {
  const q = query(collection(db, COLLECTIONS.decisions), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.data().docType === "notiftemplate").map(mapNotifTemplate);
}

export type NotifTemplateInput = Pick<NotificationTemplate, "eventType" | "enabled" | "body" | "mode" | "blocks" | "buttons" | "condition" | "stylePreset">;

/** Upsert the template for an event type (deterministic id — one per event). */
export async function upsertNotifTemplate(userId: string, input: NotifTemplateInput): Promise<void> {
  const ref = doc(db, COLLECTIONS.decisions, `notif_${userId}_${input.eventType}`);
  const created = (await docExists(ref)) ? {} : { createdAt: serverTimestamp() };
  await setDoc(ref, { userId, docType: "notiftemplate", ...input, ...created }, { merge: true });
}

export async function getNotifLog(userId: string, limit = 100): Promise<NotifLogEntry[]> {
  const q = query(collection(db, COLLECTIONS.decisions), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.data().docType === "notiflog")
    .map(mapNotifLog)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export async function addNotifLog(userId: string, entry: Pick<NotifLogEntry, "eventType" | "body" | "status">): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.decisions), { userId, docType: "notiflog", ...entry, createdAt: serverTimestamp() });
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
    proteinTarget: d.proteinTarget ?? null,
    foodBudgetWeekly: d.foodBudgetWeekly ?? null,
    bedtimeTarget: d.bedtimeTarget ?? null,
    wakeTarget: d.wakeTarget ?? null,
    sleepRoutine: d.sleepRoutine && typeof d.sleepRoutine === "object" ? (d.sleepRoutine as SleepRoutine) : null,
    telegram: d.telegram && typeof d.telegram === "object" ? (d.telegram as TelegramConfig) : null,
    aiProviders: d.aiProviders && typeof d.aiProviders === "object" ? (d.aiProviders as AIProviders) : null,
    reviewScale: d.reviewScale === 10 ? 10 : 100,
    storage: d.storage && typeof d.storage === "object" ? (d.storage as StorageConfig) : null,
  };
}

/** Persist the storage-manager config (merge write — leaves other prefs alone). */
export async function setStorageConfig(userId: string, storage: StorageConfig): Promise<void> {
  const ref = doc(db, COLLECTIONS.prefs, userId);
  await setDoc(ref, { userId, storage }, { merge: true });
}

/**
 * Estimate the user's data footprint by reading every owner-scoped document and
 * summing Firestore's documented per-document byte sizes. Returns per-collection
 * counts/bytes plus the raw docs (so cleanup/export need no extra reads).
 * NOTE: this counts document data only — real billed storage is higher (indexes).
 */
export async function scanUsage(userId: string): Promise<UsageScan> {
  const names = Object.values(COLLECTIONS);
  const results = await Promise.all(
    names.map(async (name) => {
      const q = query(collection(db, name), where("userId", "==", userId));
      const snap = await getDocs(q);
      let bytes = 0;
      const docs = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        bytes += estimateDocBytes(docSnap.id, data);
        return { id: docSnap.id, data };
      });
      return { name, count: docs.length, bytes, docs };
    })
  );
  const raw: Record<string, { id: string; data: Record<string, unknown> }[]> = {};
  let totalBytes = 0;
  let totalDocs = 0;
  const collections: CollectionUsage[] = results
    .map((r) => {
      raw[r.name] = r.docs;
      totalBytes += r.bytes;
      totalDocs += r.count;
      return {
        name: r.name,
        label: collectionLabel(r.name),
        count: r.count,
        bytes: r.bytes,
        protectedForever: isProtectedCollection(r.name),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
  return { at: Date.now(), totalBytes, totalDocs, collections, raw };
}

/** Delete many documents by id from one collection (batched under the 500 cap). */
export async function deleteDocsByIds(collectionName: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) {
      batch.delete(doc(db, collectionName, id));
    }
    await batch.commit();
  }
}

export async function upsertPrefs(
  userId: string,
  input: Partial<
    Pick<UserPrefs, "waterUnit" | "hiddenTrackers" | "sleepTarget" | "proteinTarget" | "foodBudgetWeekly" | "bedtimeTarget" | "wakeTarget" | "sleepRoutine" | "telegram" | "aiProviders" | "reviewScale">
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
