import type { FoodItem, FoodServing, FoodUnit, MealFoodEntry, NutritionMeal, PantryItem, ShoppingItem, Recipe } from "@/lib/types";

// ---------------------------------------------------------------------------
// Categories, units, serving defaults
// ---------------------------------------------------------------------------
export const FOOD_CATEGORIES = [
  "Protein", "Dairy", "Grains", "Vegetables", "Fruit", "Fats & Oils",
  "Nuts & Seeds", "Snacks", "Drinks", "Condiments", "Prepared", "Supplements", "Other",
];

export const FOOD_UNITS: FoodUnit[] = ["g", "ml"];

/** A tiny id generator for embedded rows (servings, meal-food entries). */
export function genId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `id_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Every food starts with a 100-unit serving; users add more (1 Egg, 1 Cup…). */
export function defaultServings(unit: FoodUnit): FoodServing[] {
  return [{ id: genId(), label: unit === "ml" ? "100 ml" : "100 g", grams: 100 }];
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Macros { calories: number; protein: number; carbs: number; fat: number }

/** Scale per-100-base nutrition to an arbitrary amount of base units. */
export function macrosForGrams(
  per100: Pick<FoodItem, "calories" | "protein" | "carbs" | "fat">,
  grams: number
): Macros {
  const f = grams / 100;
  return {
    calories: (per100.calories ?? 0) * f,
    protein: (per100.protein ?? 0) * f,
    carbs: (per100.carbs ?? 0) * f,
    fat: (per100.fat ?? 0) * f,
  };
}

// ---------------------------------------------------------------------------
// Pricing — auto-calculated, everything else manual
// ---------------------------------------------------------------------------
/** Cost of a single base unit (per gram / per ml). null if pricing incomplete. */
export function costPerBase(food: Pick<FoodItem, "purchasePrice" | "quantityPurchased">): number | null {
  if (food.purchasePrice == null || !food.quantityPurchased) return null;
  return food.purchasePrice / food.quantityPurchased;
}

/** Cost of one serving. null if pricing incomplete. */
export function costPerServing(
  food: Pick<FoodItem, "purchasePrice" | "quantityPurchased">,
  serving: Pick<FoodServing, "grams">
): number | null {
  const cpb = costPerBase(food);
  return cpb == null ? null : cpb * serving.grams;
}

// ---------------------------------------------------------------------------
// Meal/recipe food entries — pure references, resolved live against the library
// ---------------------------------------------------------------------------
/** foodId → FoodItem, for resolving references. */
export type FoodMap = Map<string, FoodItem>;

export function toFoodMap(foods: FoodItem[]): FoodMap {
  return new Map(foods.map((f) => [f.id, f]));
}

/** Total base units an entry represents (quantity × serving size). */
export function entryGrams(e: Pick<MealFoodEntry, "quantity" | "servingGrams">): number {
  return e.quantity * e.servingGrams;
}

/** Macros for one entry, resolved from the referenced food (0 if food missing). */
export function entryMacros(e: MealFoodEntry, food: FoodItem | undefined): Macros {
  if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return macrosForGrams(food, entryGrams(e));
}

/** Cost for one entry, resolved from the referenced food (0 if unpriced/missing). */
export function entryCost(e: MealFoodEntry, food: FoodItem | undefined): number {
  const cpb = food ? costPerBase(food) : null;
  return cpb == null ? 0 : cpb * entryGrams(e);
}

/** Reference a library food from a meal/recipe line — quantities only, no macros. */
export function foodToEntry(food: FoodItem, serving: FoodServing, quantity: number, sortOrder: number): MealFoodEntry {
  return {
    id: genId(),
    foodId: food.id,
    name: food.name,
    unit: food.unit,
    quantity,
    servingLabel: serving.label,
    servingGrams: serving.grams,
    sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Meal / recipe / day totals (feed the cards, daily summary, dashboard)
// ---------------------------------------------------------------------------
export interface MealTotals { calories: number; protein: number; carbs: number; fat: number; cost: number; hasData: boolean }

/** Sum a set of food references against the library. */
export function entriesTotals(items: MealFoodEntry[], foods: FoodMap): Omit<MealTotals, "hasData"> {
  const t = items.reduce(
    (a, e) => {
      const food = foods.get(e.foodId);
      const m = entryMacros(e, food);
      a.calories += m.calories;
      a.protein += m.protein;
      a.carbs += m.carbs;
      a.fat += m.fat;
      a.cost += entryCost(e, food);
      return a;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }
  );
  return { calories: r0(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), cost: r2(t.cost) };
}

export function mealTotals(
  meal: Pick<NutritionMeal, "items" | "calories" | "protein" | "carbs" | "fat" | "cost">,
  foods: FoodMap
): MealTotals {
  if (meal.items && meal.items.length > 0) {
    return { ...entriesTotals(meal.items, foods), hasData: true };
  }
  const hasData = meal.calories != null || meal.protein != null || meal.carbs != null || meal.fat != null || meal.cost != null;
  return {
    calories: r0(meal.calories ?? 0), protein: r1(meal.protein ?? 0), carbs: r1(meal.carbs ?? 0),
    fat: r1(meal.fat ?? 0), cost: r2(meal.cost ?? 0), hasData,
  };
}

export function dayTotals(meals: NutritionMeal[], foods: FoodMap): Omit<MealTotals, "hasData"> {
  const t = meals.reduce(
    (a, m) => {
      const mt = mealTotals(m, foods);
      a.calories += mt.calories;
      a.protein += mt.protein;
      a.carbs += mt.carbs;
      a.fat += mt.fat;
      a.cost += mt.cost;
      return a;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }
  );
  return { calories: r0(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), cost: r2(t.cost) };
}

// ---------------------------------------------------------------------------
// Library search / filter / sort
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Recipes & templates (same food-reference resolution as meals)
// ---------------------------------------------------------------------------
export function recipeTotals(recipe: Pick<Recipe, "items">, foods: FoodMap): Omit<MealTotals, "hasData"> {
  return entriesTotals(recipe.items, foods);
}

// ---------------------------------------------------------------------------
// Pantry helpers — value, stock level, expiry (all reference the food library)
// ---------------------------------------------------------------------------
function parseKey(k: string): number {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}
/** Whole days from `fromKey` to `toKey` (negative = in the past). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / 86_400_000);
}

export type StockStatus = "out" | "low" | "ok";
export function stockStatus(item: Pick<PantryItem, "quantityRemaining" | "lowThreshold">): StockStatus {
  if (item.quantityRemaining <= 0) return "out";
  if (item.lowThreshold != null && item.quantityRemaining <= item.lowThreshold) return "low";
  return "ok";
}

export type ExpiryStatus = "expired" | "soon" | "ok" | "none";
export function expiryStatus(item: Pick<PantryItem, "expirationDate">, todayKey: string, withinDays = 5): ExpiryStatus {
  if (!item.expirationDate) return "none";
  const d = daysBetween(todayKey, item.expirationDate);
  if (d < 0) return "expired";
  if (d <= withinDays) return "soon";
  return "ok";
}

/** Estimated value of one lot: prefer its own unit price, else the food's. */
export function pantryItemValue(item: PantryItem, food: FoodItem | undefined): number {
  if (item.purchasePrice != null && item.quantity && item.quantity > 0) {
    return r2((item.purchasePrice / item.quantity) * item.quantityRemaining);
  }
  const cpb = food ? costPerBase(food) : null;
  return cpb == null ? 0 : r2(cpb * item.quantityRemaining);
}
export function pantryValue(items: PantryItem[], foods: FoodMap): number {
  return r2(items.reduce((s, it) => s + pantryItemValue(it, foods.get(it.foodId ?? "")), 0));
}

// ---------------------------------------------------------------------------
// Shopping helpers
// ---------------------------------------------------------------------------
/** Line cost: manual estimate if set, else derived from the food's price. */
export function shoppingItemCost(item: ShoppingItem, food: FoodItem | undefined): number {
  if (item.estCost != null) return item.estCost;
  const cpb = food ? costPerBase(food) : null;
  if (cpb == null || item.quantity == null) return 0;
  return r2(cpb * item.quantity);
}
export function shoppingCost(items: ShoppingItem[], foods: FoodMap, opts?: { unpurchasedOnly?: boolean }): number {
  return r2(
    items
      .filter((it) => (opts?.unpurchasedOnly ? !it.purchased : true))
      .reduce((s, it) => s + shoppingItemCost(it, foods.get(it.foodId ?? "")), 0)
  );
}

export type FoodSort = "custom" | "name" | "calories" | "cost" | "recent";

export const FOOD_SORTS: { value: FoodSort; label: string }[] = [
  { value: "custom", label: "Custom order" },
  { value: "name", label: "Name (A–Z)" },
  { value: "calories", label: "Calories (high→low)" },
  { value: "cost", label: "Cost / serving (low→high)" },
  { value: "recent", label: "Recently added" },
];

export interface FoodFilter {
  search: string;
  category: string | null;
  tags: string[];
  favorites: boolean;
  archived: boolean; // when false, hide archived; when true, show ONLY archived
}

export function allFoodTags(foods: FoodItem[]): string[] {
  const set = new Set<string>();
  for (const f of foods) for (const t of f.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterFoods(foods: FoodItem[], f: FoodFilter): FoodItem[] {
  const q = f.search.trim().toLowerCase();
  return foods.filter((food) => {
    if (f.archived ? !food.archived : food.archived) return false;
    if (f.favorites && !food.favorite) return false;
    if (f.category && food.category !== f.category) return false;
    if (f.tags.length && !f.tags.every((t) => food.tags.includes(t))) return false;
    if (q) {
      const hay = `${food.name} ${food.brand ?? ""} ${food.category ?? ""} ${food.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortFoods(foods: FoodItem[], sort: FoodSort): FoodItem[] {
  const list = [...foods];
  switch (sort) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "calories":
      return list.sort((a, b) => (b.calories ?? -1) - (a.calories ?? -1));
    case "cost":
      return list.sort((a, b) => {
        const ca = costPerServing(a, a.servings[0] ?? { grams: 100 });
        const cb = costPerServing(b, b.servings[0] ?? { grams: 100 });
        return (ca ?? Infinity) - (cb ?? Infinity);
      });
    case "recent":
      return list.sort((a, b) => b.createdAt - a.createdAt);
    default:
      return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }
}
