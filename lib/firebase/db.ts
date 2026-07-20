import {
  collection,
  query,
  where,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS, type Goal, type Habit } from "@/lib/types";

/** Convert a Firestore Timestamp (or null during pending writes) to epoch ms. */
function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return 0;
}

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

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Top active goals for a user. Filtering/sorting is done client-side so no
 * Firestore composite index is required for the dashboard.
 */
export async function getActiveGoals(userId: string, max = 3): Promise<Goal[]> {
  const q = query(
    collection(db, COLLECTIONS.goals),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapGoal)
    .filter((g) => g.status === "active")
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
    )
    .slice(0, max);
}

/** Daily habits for a user, sorted by creation order. */
export async function getDailyHabits(userId: string): Promise<Habit[]> {
  const q = query(
    collection(db, COLLECTIONS.habits),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapHabit)
    .filter((h) => h.frequency === "daily")
    .sort((a, b) => a.createdAt - b.createdAt);
}
