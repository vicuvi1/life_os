// Emoji used as a consistent functional icon language across the app.

import type {
  GoalCategory,
  HabitCategory,
  SessionCategory,
} from "@/lib/types";

export const GOAL_CATEGORY_EMOJI: Record<GoalCategory, string> = {
  education: "📚",
  career: "💼",
  health: "🏋️",
  financial: "💰",
  personal: "🌱",
};

export const HABIT_CATEGORY_EMOJI: Record<HabitCategory, string> = {
  morning: "🌅",
  evening: "🌙",
  exercise: "🏋️",
  learning: "📖",
  health: "💊",
};

export const SESSION_CATEGORY_EMOJI: Record<SessionCategory, string> = {
  study: "📖",
  workout: "🏋️",
  deep_work: "🧠",
  admin: "🗂️",
  personal: "🌱",
  other: "📌",
};

/** Section / concept emojis used in headers and tiles. */
export const EMOJI = {
  focus: "📋",
  goals: "🎯",
  projects: "🗂️",
  tasks: "✅",
  habits: "🔥",
  schedule: "🕖",
  sessions: "🕖",
  water: "💧",
  sleep: "😴",
  nutrition: "🥗",
  meals: "🍽️",
  expenses: "💰",
  calendar: "🗓️",
  insights: "📈",
  progress: "📈",
  streak: "🔥",
  reminders: "🔔",
  routines: "👕",
  review: "📝",
} as const;

/** Time-of-day emoji, used functionally next to the greeting (aligned with greetingFor's bands). */
export function greetingEmoji(hour: number): string {
  if (hour < 5) return "🌙";
  if (hour < 12) return "🌅";
  if (hour < 17) return "☀️";
  if (hour < 22) return "🌆";
  return "🌙";
}
