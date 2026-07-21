import type { NutritionLog, NutritionMeal } from "@/lib/types";
import { dayTotals, type FoodMap } from "@/lib/food";

export const DEFAULT_WATER_TARGET = 8;
export const DEFAULT_PROTEIN_TARGET = 100; // grams/day

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---------------------------------------------------------------------------
// Meal customization palettes + quick-start templates
// ---------------------------------------------------------------------------
export const MEAL_ICONS = ["🍳", "🥗", "🍽️", "🍎", "🥪", "🍜", "🍲", "🥑", "🍗", "🍚", "🥛", "☕", "🍌", "🥤", "🍫", "🌙", "💪", "🔥", "🧃", "🍕"];

export const MEAL_COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ec4899", "#ef4444", "#14b8a6", "#a855f7", "#0ea5e9", "#84cc16", "#f97316"];

/** Sensible name + icon + colour for a new meal based on the time of day — so the
 * common path needs zero typing. Fully overridable. */
export function mealDefaultsByTime(date = new Date()): { name: string; icon: string; color: string } {
  const h = date.getHours();
  if (h < 11) return { name: "Breakfast", icon: "🍳", color: "#8b5cf6" };
  if (h < 15) return { name: "Lunch", icon: "🥗", color: "#f59e0b" };
  if (h < 18) return { name: "Snack", icon: "🍎", color: "#ec4899" };
  if (h < 22) return { name: "Dinner", icon: "🍽️", color: "#0ea5e9" };
  return { name: "Late night", icon: "🌙", color: "#a855f7" };
}

// ---------------------------------------------------------------------------
// Timeline grouping — meals stay fully custom; sections are derived, never enforced
// ---------------------------------------------------------------------------
export type MealBucket = "breakfast" | "lunch" | "snack" | "dinner" | "late" | "anytime";

export const MEAL_BUCKETS: { key: MealBucket; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "🍳" },
  { key: "lunch", label: "Lunch", emoji: "🥗" },
  { key: "snack", label: "Snacks", emoji: "🍎" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "late", label: "Late night", emoji: "🌙" },
  { key: "anytime", label: "Anytime", emoji: "🕘" },
];

/** Derive a timeline section for a meal. The meal's own name wins (so custom
 * names like "Post-workout breakfast" group sensibly); otherwise its time; a
 * meal with neither goes to "Anytime". Purely presentational — never stored. */
export function mealBucket(meal: { name: string; time: string | null }): MealBucket {
  const n = meal.name.toLowerCase();
  if (/(breakfast|brunch)/.test(n)) return "breakfast";
  if (/lunch/.test(n)) return "lunch";
  if (/(snack|pre.?workout|post.?workout|shake)/.test(n)) return "snack";
  if (/(dinner|supper)/.test(n)) return "dinner";
  if (/(late|night)/.test(n)) return "late";
  if (meal.time) {
    const h = Number(meal.time.slice(0, 2));
    if (h < 11) return "breakfast";
    if (h < 15) return "lunch";
    if (h < 18) return "snack";
    if (h < 22) return "dinner";
    return "late";
  }
  return "anytime";
}

export interface MealTemplate { name: string; icon: string; color: string; time: string }
export const MEAL_TEMPLATES: MealTemplate[] = [
  { name: "Breakfast", icon: "🍳", color: "#f59e0b", time: "08:00" },
  { name: "Lunch", icon: "🥗", color: "#10b981", time: "13:00" },
  { name: "Dinner", icon: "🍽️", color: "#6366f1", time: "19:00" },
  { name: "Snack", icon: "🍎", color: "#ec4899", time: "16:00" },
  { name: "Pre Workout", icon: "🍌", color: "#f97316", time: "17:00" },
  { name: "Post Workout", icon: "💪", color: "#14b8a6", time: "18:30" },
  { name: "Late Night", icon: "🌙", color: "#a855f7", time: "22:30" },
  { name: "Meal Prep", icon: "🍲", color: "#0ea5e9", time: "" },
];

// ---------------------------------------------------------------------------
// Daily summary + health score
// ---------------------------------------------------------------------------
export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost: number;
  water: number;
  waterTarget: number;
  mealCount: number;
  healthScore: number;
}

/**
 * Health score 0-100 — deliberately NOT calorie-driven. Rewards hydration,
 * eating consistently, and (if you track it) hitting your protein goal.
 */
export function healthScore(opts: {
  water: number;
  waterTarget: number;
  mealCount: number;
  protein: number;
  proteinTarget: number;
}): number {
  const waterPct = clamp01(opts.water / (opts.waterTarget || DEFAULT_WATER_TARGET));
  const mealsFactor = clamp01(opts.mealCount / 3);
  // Only let protein pull the score down once you're actually logging it.
  const proteinPct = opts.protein > 0 ? clamp01(opts.protein / (opts.proteinTarget || DEFAULT_PROTEIN_TARGET)) : mealsFactor;
  return Math.round(100 * (0.5 * waterPct + 0.3 * mealsFactor + 0.2 * proteinPct));
}

export function nutritionSummary(
  meals: NutritionMeal[],
  water: number,
  waterTarget: number,
  proteinTarget: number,
  foods: FoodMap
): NutritionSummary {
  const t = dayTotals(meals, foods);
  return {
    calories: t.calories,
    protein: t.protein,
    carbs: t.carbs,
    fat: t.fat,
    cost: t.cost,
    water,
    waterTarget,
    mealCount: meals.length,
    healthScore: healthScore({ water, waterTarget, mealCount: meals.length, protein: t.protein, proteinTarget }),
  };
}

/** Label + colour for a health score. */
export function healthMeta(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "#10b981" };
  if (score >= 65) return { label: "Good", color: "#84cc16" };
  if (score >= 40) return { label: "Fair", color: "#f59e0b" };
  return { label: "Low", color: "#f43f5e" };
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

/** Hydration rating vs the day's target. */
export function hydrationRating(
  glasses: number,
  target: number
): { label: string; variant: BadgeVariant } {
  if (target <= 0) return { label: "—", variant: "secondary" };
  const ratio = glasses / target;
  if (ratio >= 1) return { label: "Hydrated", variant: "success" };
  if (ratio >= 0.6) return { label: "Almost", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

/** How many of the three main meals were eaten. */
export function mealsEaten(
  log: Pick<NutritionLog, "breakfast" | "lunch" | "dinner">
): number {
  return (log.breakfast ? 1 : 0) + (log.lunch ? 1 : 0) + (log.dinner ? 1 : 0);
}

/** A sensible empty log for a given date before anything is saved. */
export function emptyNutrition(date: string): Omit<NutritionLog, "id" | "userId" | "createdAt"> {
  return {
    date,
    water: 0,
    waterTarget: DEFAULT_WATER_TARGET,
    breakfast: false,
    lunch: false,
    dinner: false,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    cost: null,
    notes: null,
  };
}
