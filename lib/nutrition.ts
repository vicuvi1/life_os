import type { NutritionLog } from "@/lib/types";

export const DEFAULT_WATER_TARGET = 8;

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
    notes: null,
  };
}
