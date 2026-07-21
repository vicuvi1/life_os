import type { HabitCategory, HabitDifficulty, HabitTargetType } from "@/lib/types";

/** A ready-made habit offered by a template pack. */
export interface HabitTemplate {
  title: string;
  emoji: string;
  tags: string[];
  category: HabitCategory;
  color: string;
  targetType: HabitTargetType;
  targetValue: number | null;
  difficulty: HabitDifficulty;
}

export interface TemplatePack {
  key: string;
  name: string;
  emoji: string;
  description: string;
  habits: HabitTemplate[];
}

const C = {
  violet: "#8b5cf6",
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  pink: "#ec4899",
  lime: "#84cc16",
};

export const TEMPLATE_PACKS: TemplatePack[] = [
  {
    key: "morning",
    name: "Morning",
    emoji: "☀️",
    description: "Start the day with intention.",
    habits: [
      { title: "Drink water", emoji: "💧", tags: ["morning", "health"], category: "morning", color: C.cyan, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "Make bed", emoji: "🛏️", tags: ["morning"], category: "morning", color: C.blue, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "Meditate", emoji: "🧘", tags: ["morning", "mind"], category: "morning", color: C.violet, targetType: "duration", targetValue: 10, difficulty: "medium" },
      { title: "Vitamins", emoji: "💊", tags: ["morning", "health"], category: "health", color: C.amber, targetType: "check", targetValue: null, difficulty: "easy" },
    ],
  },
  {
    key: "gym",
    name: "Gym",
    emoji: "💪",
    description: "Build strength and consistency.",
    habits: [
      { title: "Workout", emoji: "🏋️", tags: ["fitness"], category: "exercise", color: C.rose, targetType: "check", targetValue: null, difficulty: "hard" },
      { title: "Steps", emoji: "🚶", tags: ["fitness"], category: "exercise", color: C.lime, targetType: "count", targetValue: 8000, difficulty: "medium" },
      { title: "Protein", emoji: "🥩", tags: ["fitness", "nutrition"], category: "health", color: C.amber, targetType: "check", targetValue: null, difficulty: "medium" },
      { title: "Stretch", emoji: "🤸", tags: ["fitness"], category: "exercise", color: C.emerald, targetType: "duration", targetValue: 10, difficulty: "easy" },
    ],
  },
  {
    key: "study",
    name: "Study",
    emoji: "📚",
    description: "For students and lifelong learners.",
    habits: [
      { title: "Deep work", emoji: "🧠", tags: ["study", "focus"], category: "learning", color: C.violet, targetType: "duration", targetValue: 60, difficulty: "hard" },
      { title: "Read", emoji: "📖", tags: ["study"], category: "learning", color: C.blue, targetType: "count", targetValue: 20, difficulty: "medium" },
      { title: "Review notes", emoji: "✍️", tags: ["study"], category: "learning", color: C.cyan, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "No phone while studying", emoji: "🚫", tags: ["focus"], category: "learning", color: C.rose, targetType: "check", targetValue: null, difficulty: "hard" },
    ],
  },
  {
    key: "productivity",
    name: "Productivity",
    emoji: "⚡",
    description: "Ship more, drift less.",
    habits: [
      { title: "Plan the day", emoji: "🗒️", tags: ["work"], category: "morning", color: C.blue, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "Inbox zero", emoji: "📥", tags: ["work"], category: "learning", color: C.cyan, targetType: "check", targetValue: null, difficulty: "medium" },
      { title: "One big task", emoji: "🎯", tags: ["work", "focus"], category: "learning", color: C.violet, targetType: "check", targetValue: null, difficulty: "hard" },
      { title: "Shut down ritual", emoji: "🔚", tags: ["work"], category: "evening", color: C.amber, targetType: "check", targetValue: null, difficulty: "easy" },
    ],
  },
  {
    key: "health",
    name: "Health",
    emoji: "🩺",
    description: "Take care of the basics.",
    habits: [
      { title: "8 glasses water", emoji: "💧", tags: ["health"], category: "health", color: C.cyan, targetType: "count", targetValue: 8, difficulty: "medium" },
      { title: "Eat a vegetable", emoji: "🥗", tags: ["health", "nutrition"], category: "health", color: C.lime, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "10k steps", emoji: "👟", tags: ["health", "fitness"], category: "exercise", color: C.emerald, targetType: "count", targetValue: 10000, difficulty: "medium" },
      { title: "No sugar", emoji: "🍭", tags: ["health"], category: "health", color: C.rose, targetType: "check", targetValue: null, difficulty: "hard" },
    ],
  },
  {
    key: "night",
    name: "Night",
    emoji: "🌙",
    description: "Wind down for better sleep.",
    habits: [
      { title: "No screens after 10pm", emoji: "📵", tags: ["evening", "sleep"], category: "evening", color: C.violet, targetType: "check", targetValue: null, difficulty: "hard" },
      { title: "Journal", emoji: "📓", tags: ["evening", "mind"], category: "evening", color: C.blue, targetType: "check", targetValue: null, difficulty: "easy" },
      { title: "Read (fiction)", emoji: "📕", tags: ["evening"], category: "evening", color: C.amber, targetType: "duration", targetValue: 15, difficulty: "easy" },
      { title: "Sleep by 11pm", emoji: "😴", tags: ["sleep"], category: "evening", color: C.cyan, targetType: "check", targetValue: null, difficulty: "medium" },
    ],
  },
];
