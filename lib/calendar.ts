// Smart Calendar — aggregate every data source into per-day views.

import type {
  Goal,
  Habit,
  HabitLog,
  Session,
  SleepLog,
  Task,
} from "@/lib/types";
import { findConflicts } from "@/lib/sessions";

export type CalElement = "sessions" | "tasks" | "habits" | "sleep" | "goals";

export const CAL_ELEMENTS: { key: CalElement; label: string }[] = [
  { key: "sessions", label: "Sessions" },
  { key: "tasks", label: "Tasks" },
  { key: "habits", label: "Habits" },
  { key: "sleep", label: "Sleep" },
  { key: "goals", label: "Deadlines" },
];

export type CalToggles = Record<CalElement, boolean>;

export const DEFAULT_TOGGLES: CalToggles = {
  sessions: true,
  tasks: true,
  habits: true,
  sleep: true,
  goals: true,
};

export interface CalSources {
  sessions: Session[];
  tasks: Task[];
  dailyHabits: Habit[];
  habitLogs: HabitLog[];
  sleep: SleepLog[];
  goals: Goal[];
}

export interface CalData {
  sessionsByDate: Map<string, Session[]>;
  conflicts: Set<string>;
  tasksByDate: Map<string, Task[]>;
  sleepByDate: Map<string, SleepLog>;
  habitDoneByDate: Map<string, number>;
  dailyHabitCount: number;
  goalsByDeadline: Map<string, Goal[]>;
}

function pushInto<T>(map: Map<string, T[]>, key: string, value: T) {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

export function buildCalData(src: CalSources): CalData {
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of src.sessions) pushInto(sessionsByDate, s.date, s);
  for (const arr of sessionsByDate.values())
    arr.sort((a, b) => a.startMin - b.startMin);

  const tasksByDate = new Map<string, Task[]>();
  for (const t of src.tasks) {
    if (t.dueDate) pushInto(tasksByDate, t.dueDate, t);
  }

  const sleepByDate = new Map<string, SleepLog>();
  for (const s of src.sleep) sleepByDate.set(s.date, s);

  const dailyHabitIds = new Set(src.dailyHabits.map((h) => h.id));
  const habitDoneByDate = new Map<string, number>();
  for (const log of src.habitLogs) {
    if (!dailyHabitIds.has(log.habitId)) continue;
    habitDoneByDate.set(
      log.completedDate,
      (habitDoneByDate.get(log.completedDate) ?? 0) + 1
    );
  }

  const goalsByDeadline = new Map<string, Goal[]>();
  for (const g of src.goals) {
    if (g.deadline) pushInto(goalsByDeadline, g.deadline, g);
  }

  return {
    sessionsByDate,
    conflicts: findConflicts(src.sessions),
    tasksByDate,
    sleepByDate,
    habitDoneByDate,
    dailyHabitCount: src.dailyHabits.length,
    goalsByDeadline,
  };
}

export interface DayView {
  date: string;
  sessions: Session[];
  tasks: Task[];
  sleep: SleepLog | null;
  habitsDone: number;
  habitsTotal: number;
  goalDeadlines: Goal[];
}

export function dayView(data: CalData, date: string): DayView {
  return {
    date,
    sessions: data.sessionsByDate.get(date) ?? [],
    tasks: data.tasksByDate.get(date) ?? [],
    sleep: data.sleepByDate.get(date) ?? null,
    habitsDone: data.habitDoneByDate.get(date) ?? 0,
    habitsTotal: data.dailyHabitCount,
    goalDeadlines: data.goalsByDeadline.get(date) ?? [],
  };
}

/** Whether a day has anything to show given the active toggles. */
export function dayHasContent(d: DayView, toggles: CalToggles): boolean {
  return (
    (toggles.sessions && d.sessions.length > 0) ||
    (toggles.tasks && d.tasks.length > 0) ||
    (toggles.sleep && d.sleep != null) ||
    (toggles.habits && d.habitsDone > 0) ||
    (toggles.goals && d.goalDeadlines.length > 0)
  );
}
