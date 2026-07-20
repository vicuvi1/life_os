"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ShoppingCart,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getMeals,
  getMealPlan,
  setMealPlanEntry,
  getShoppingCheck,
  upsertShoppingCheck,
  deleteMeal,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { startOfWeekKey, formatWeekRange, formatLongDate } from "@/lib/dates";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  MEAL_SLOT_ICON,
  buildShoppingList,
  planCost,
  normalizeItem,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MealFormDialog } from "@/components/meals/meal-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Meal, MealPlanEntry, MealSlot } from "@/lib/types";

const NONE = "__none__";

export default function MealsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [weekStart, setWeekStart] = useState(startOfWeekKey(today));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plan, setPlan] = useState<MealPlanEntry[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [mealForm, setMealForm] = useState<{ open: boolean; meal: Meal | null }>({
    open: false,
    meal: null,
  });
  const [deletingMeal, setDeletingMeal] = useState<Meal | null>(null);
  const [newItem, setNewItem] = useState("");

  const weekReqRef = useRef(0);

  const loadCore = useCallback(async () => {
    if (!user) return;
    const [m, p] = await Promise.all([getMeals(user.uid), getMealPlan(user.uid)]);
    setMeals(m);
    setPlan(p);
  }, [user]);

  // Meal library + plan load once per user (not on every week change).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await loadCore();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadCore]);

  // Shopping-check state is per week; guard against out-of-order responses.
  useEffect(() => {
    if (!user) return;
    const req = ++weekReqRef.current;
    (async () => {
      const sc = await getShoppingCheck(user.uid, weekStart);
      if (weekReqRef.current !== req) return; // a newer week was selected
      setChecked(sc?.checked ?? []);
      setExtra(sc?.extra ?? []);
    })();
  }, [user, weekStart]);

  const mealsById = useMemo(
    () => new Map(meals.map((m) => [m.id, m])),
    [meals]
  );
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekSet = useMemo(() => new Set(weekDates), [weekDates]);
  const weekEntries = useMemo(
    () => plan.filter((e) => weekSet.has(e.date)),
    [plan, weekSet]
  );

  const entryFor = useCallback(
    (date: string, slot: MealSlot) =>
      weekEntries.find((e) => e.date === date && e.slot === slot)?.mealId ?? null,
    [weekEntries]
  );

  const shoppingItems = useMemo(
    () => buildShoppingList(weekEntries, mealsById, extra),
    [weekEntries, mealsById, extra]
  );
  const cost = useMemo(
    () => planCost(weekEntries, mealsById),
    [weekEntries, mealsById]
  );
  const checkedSet = useMemo(() => new Set(checked), [checked]);

  async function assignMeal(date: string, slot: MealSlot, value: string) {
    if (!user) return;
    const mealId = value === NONE ? null : value;
    // Optimistic local update.
    setPlan((prev) => {
      const rest = prev.filter((e) => !(e.date === date && e.slot === slot));
      return mealId
        ? [...rest, { id: `${user.uid}_${date}_${slot}`, userId: user.uid, date, slot, mealId }]
        : rest;
    });
    await setMealPlanEntry(user.uid, date, slot, mealId);
  }

  async function persistShopping(nextChecked: string[], nextExtra: string[]) {
    if (!user) return;
    await upsertShoppingCheck(user.uid, weekStart, {
      checked: nextChecked,
      extra: nextExtra,
    });
  }

  function toggleItem(key: string, isChecked: boolean) {
    const next = isChecked
      ? Array.from(new Set([...checked, key]))
      : checked.filter((k) => k !== key);
    setChecked(next);
    void persistShopping(next, extra);
  }

  function addExtra(e: React.FormEvent) {
    e.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    const key = normalizeItem(name);
    // Don't duplicate something already on the list.
    if (shoppingItems.some((i) => i.key === key)) {
      setNewItem("");
      return;
    }
    const next = [...extra, name];
    setExtra(next);
    setNewItem("");
    void persistShopping(checked, next);
  }

  function removeExtra(key: string) {
    const next = extra.filter((x) => normalizeItem(x) !== key);
    const nextChecked = checked.filter((k) => k !== key);
    setExtra(next);
    setChecked(nextChecked);
    void persistShopping(nextChecked, next);
  }

  const isThisWeek = weekStart === startOfWeekKey(today);
  const checkedCount = shoppingItems.filter((i) => checkedSet.has(i.key)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Meals</h1>
          <p className="text-muted-foreground">
            Plan the week once — the shopping list builds itself.
          </p>
        </div>
        {user && (
          <Button onClick={() => setMealForm({ open: true, meal: null })}>
            <Plus className="h-4 w-4" /> New meal
          </Button>
        )}
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{formatWeekRange(weekStart)}</p>
          {isThisWeek ? (
            <Badge variant="default" className="mt-1">
              This week
            </Badge>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setWeekStart(startOfWeekKey(today))}
            >
              Jump to this week
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : meals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Build your meal library first</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a few go-to meals with their ingredients, then drop them into
              each day. Your shopping list is generated from what you plan.
            </p>
            <Button onClick={() => setMealForm({ open: true, meal: null })}>
              <Plus className="h-4 w-4" /> Add your first meal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Weekly plan */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weekDates.map((date) => (
              <Card key={date} className={cn(date === today && "border-primary/50")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {formatLongDate(date)}
                    {date === today && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        Today
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {MEAL_SLOTS.map((slot) => {
                    const slotMeals = meals.filter((m) => m.slot === slot);
                    const value = entryFor(date, slot) ?? NONE;
                    return (
                      <div key={slot} className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {MEAL_SLOT_ICON[slot]} {MEAL_SLOT_LABEL[slot]}
                        </p>
                        <Select
                          value={value}
                          onValueChange={(v) => assignMeal(date, slot, v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {slotMeals.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Shopping list */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5 text-primary" /> Shopping list
              </CardTitle>
              <div className="flex items-center gap-2">
                {cost > 0 && (
                  <Badge variant="secondary">~{cost.toFixed(0)} est.</Badge>
                )}
                {shoppingItems.length > 0 && (
                  <Badge variant="outline">
                    {checkedCount}/{shoppingItems.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={addExtra} className="flex gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Add an item (e.g. olive oil)…"
                />
                <Button type="submit" variant="outline" disabled={!newItem.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </form>

              {shoppingItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Assign meals above (or add items) to build your list.
                </p>
              ) : (
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {shoppingItems.map((item) => {
                    const isChecked = checkedSet.has(item.key);
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-3 border-b py-2 last:border-0"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) => toggleItem(item.key, Boolean(c))}
                        />
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            isChecked && "text-muted-foreground line-through"
                          )}
                        >
                          {item.name}
                          {item.count > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ×{item.count}
                            </span>
                          )}
                        </span>
                        {item.custom && (
                          <button
                            aria-label="Remove item"
                            onClick={() => removeExtra(item.key)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meal library */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Your meals ({meals.length})
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {meals.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">{MEAL_SLOT_ICON[m.slot]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {MEAL_SLOT_LABEL[m.slot]}
                        {m.ingredients.length > 0 &&
                          ` · ${m.ingredients.join(", ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Edit meal"
                        onClick={() => setMealForm({ open: true, meal: m })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete meal"
                        onClick={() => setDeletingMeal(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {user && (
        <MealFormDialog
          open={mealForm.open}
          onOpenChange={(o) => setMealForm((s) => ({ ...s, open: o }))}
          userId={user.uid}
          meal={mealForm.meal}
          onSaved={loadCore}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingMeal)}
        onOpenChange={(o) => !o && setDeletingMeal(null)}
        title="Delete this meal?"
        description="It will be removed from your library. Days you already planned it on will show empty."
        onConfirm={async () => {
          if (deletingMeal) {
            await deleteMeal(deletingMeal.id);
            setDeletingMeal(null);
            await loadCore();
          }
        }}
      />
    </div>
  );
}
