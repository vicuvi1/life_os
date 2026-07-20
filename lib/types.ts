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

/** Firestore collection names, centralized to avoid typos. */
export const COLLECTIONS = {
  goals: "goals",
  projects: "projects",
  tasks: "tasks",
  habits: "habits",
  habitLogs: "habitLogs",
  weeklyReviews: "weeklyReviews",
} as const;
