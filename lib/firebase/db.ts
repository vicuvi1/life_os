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
  type Goal,
  type Habit,
  type HabitLog,
  type Project,
  type Session,
  type Task,
  type WeeklyReview,
} from "@/lib/types";
import { currentStreak, longestStreak } from "@/lib/habits";
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

export async function getGoal(id: string): Promise<Goal | null> {
  const ref = doc(db, COLLECTIONS.goals, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapGoal(snap as QueryDocumentSnapshot<DocumentData>);
}

export type GoalInput = Pick<
  Goal,
  "title" | "description" | "status" | "priority" | "deadline" | "quarter" | "category"
>;

export async function createGoal(
  userId: string,
  input: GoalInput
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.goals), {
    userId,
    ...input,
    progress: 0,
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
 * it on the goal document. Called after any task mutation.
 */
export async function recalcGoalProgress(goalId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.tasks), where("goalId", "==", goalId))
  );
  const tasks = snap.docs.map((t) => t.data());
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  await updateDoc(doc(db, COLLECTIONS.goals, goalId), { progress });
  return progress;
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
  "title" | "description" | "frequency" | "category" | "color"
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
 * Mark (or unmark) a habit as done for a given date, then recompute and persist
 * its current streak, best streak, and last-completed date.
 * Log docs use a deterministic id (`habitId_date`) so completion is idempotent.
 */
export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date: string,
  done: boolean
): Promise<void> {
  const logRef = doc(db, COLLECTIONS.habitLogs, `${habitId}_${date}`);
  if (done) {
    await setDoc(logRef, {
      userId,
      habitId,
      completedDate: date,
      createdAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(logRef);
  }

  // Recompute streaks from the habit's full log history.
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.habitLogs), where("habitId", "==", habitId))
  );
  const dates = snap.docs.map((d) => d.data().completedDate as string);
  const today = toDateKey(new Date());
  const streak = currentStreak(new Set(dates), today);
  const best = longestStreak(dates);
  const lastCompleted =
    dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  await updateDoc(doc(db, COLLECTIONS.habits, habitId), {
    streak,
    bestStreak: best,
    lastCompleted,
  });
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
