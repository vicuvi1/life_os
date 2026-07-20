import type { Meal, MealPlanEntry, MealSlot } from "@/lib/types";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const MEAL_SLOT_ICON: Record<MealSlot, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
};

/** Parse a comma/newline-separated ingredients string into a clean list. */
export function parseIngredients(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Normalize an item name for de-duplication and check-off matching. */
export function normalizeItem(name: string): string {
  return name.trim().toLowerCase();
}

export interface ShoppingItem {
  /** Display name (first-seen casing). */
  name: string;
  /** Normalized key. */
  key: string;
  /** How many planned meals use it. */
  count: number;
  /** True if manually added rather than derived from the plan. */
  custom?: boolean;
}

/**
 * Build a de-duplicated shopping list from the week's planned meals, plus any
 * manually added extras. Sorted alphabetically by display name.
 */
export function buildShoppingList(
  entries: MealPlanEntry[],
  mealsById: Map<string, Meal>,
  extra: string[] = []
): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();

  for (const entry of entries) {
    const meal = mealsById.get(entry.mealId);
    if (!meal) continue;
    for (const ing of meal.ingredients) {
      const key = normalizeItem(ing);
      if (!key) continue;
      const existing = items.get(key);
      if (existing) existing.count += 1;
      else items.set(key, { name: ing.trim(), key, count: 1 });
    }
  }

  for (const raw of extra) {
    const key = normalizeItem(raw);
    if (!key) continue;
    if (!items.has(key)) {
      items.set(key, { name: raw.trim(), key, count: 0, custom: true });
    }
  }

  return Array.from(items.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Total estimated cost of the week's planned meals. */
export function planCost(
  entries: MealPlanEntry[],
  mealsById: Map<string, Meal>
): number {
  return entries.reduce((sum, e) => {
    const meal = mealsById.get(e.mealId);
    return sum + (meal?.estCost ?? 0);
  }, 0);
}
