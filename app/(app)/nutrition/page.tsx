"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Minus, Search, Package, Utensils, CalendarDays, Clock, Star, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionAll, upsertNutritionLog, createNutritionMeal, deleteNutritionMeal,
  reorderNutritionMeals, createShoppingItem, updateShoppingItem, getPrefs, upsertPrefs, getBudget,
  type NutritionAll,
} from "@/lib/firebase/db";
import { greetingFor, resolveFirstName, toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate, startOfWeekKey } from "@/lib/dates";
import { DEFAULT_WATER_TARGET, DEFAULT_PROTEIN_TARGET, healthScore, healthMeta, mealBucket, MEAL_BUCKETS } from "@/lib/nutrition";
import { NutritionRings } from "@/components/nutrition/nutrition-rings";
import { dayTotals, toFoodMap, mealTotals, recipeTotals, foodToEntry, genId, stockStatus, expiryStatus, daysBetween } from "@/lib/food";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { MealRow } from "@/components/nutrition/meal-row";
import { MealDialog } from "@/components/nutrition/meal-dialog";
import { cn } from "@/lib/utils";
import type { NutritionMeal, Recipe, FoodItem, ShoppingItem, MealFoodEntry } from "@/lib/types";

const DEFAULT_CAL_TARGET = 2000;
const fmt = (n: number) => n.toLocaleString("en-US");
const soft = "border-border/40 shadow-sm"; // softer, premium surface

export default function NutritionPage() {
  const { user, displayName } = useAuth();
  const router = useRouter();
  const today = toDateKey(new Date());
  const [date, setDate] = useState(today);
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [waterUnit, setWaterUnit] = useState("glasses");
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CAL_TARGET);
  const [weeklyBudget, setWeeklyBudget] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; meal: NutritionMeal | null; seed?: MealFoodEntry[] }>({ open: false, meal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [mealSort, setMealSort] = useState<"group" | "time" | "custom">("group");
  const [foodQuery, setFoodQuery] = useState("");
  const [newShop, setNewShop] = useState("");

  const load = useCallback(async (opts?: { quiet?: boolean; sync?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [data, prefs, budget] = await Promise.all([getNutritionAll(user.uid), getPrefs(user.uid), getBudget(user.uid)]);
      setAll(data);
      setWaterUnit(prefs.waterUnit);
      setProteinTarget(prefs.proteinTarget ?? DEFAULT_PROTEIN_TARGET);
      setCalorieTarget(prefs.calorieTarget ?? DEFAULT_CAL_TARGET);
      setWeeklyBudget(prefs.foodBudgetWeekly ?? null);
      setCurrency(resolveCurrency(budget));
      if (opts?.sync) {
        const dm = data.meals.filter((m) => m.date === date);
        void upsertNutritionLog(user.uid, date, dayTotals(dm, toFoodMap(data.foods))).catch(() => {});
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user, date]);

  useEffect(() => { load(); }, [load]);

  const foodMap = useMemo(() => toFoodMap(all?.foods ?? []), [all]);
  const meals = useMemo(() => {
    const list = (all?.meals ?? []).filter((m) => m.date === date);
    if (mealSort === "custom") return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
    return list.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.sortOrder - b.sortOrder);
  }, [all, date, mealSort]);
  const dayLog = useMemo(() => (all?.logs ?? []).find((l) => l.date === date) ?? null, [all, date]);
  // Derived straight from the day's log — single source of truth, no effect race.
  const water = dayLog?.water ?? 0;
  const waterTarget = dayLog?.waterTarget ?? DEFAULT_WATER_TARGET;

  // Timeline sections (group mode): derived buckets, only non-empty ones render.
  const sections = useMemo(() => {
    if (mealSort !== "group") return null;
    return MEAL_BUCKETS.map((b) => {
      const ms = meals.filter((m) => mealBucket(m) === b.key);
      const t = dayTotals(ms, foodMap);
      return { ...b, meals: ms, calories: t.calories, protein: t.protein };
    }).filter((s) => s.meals.length > 0);
  }, [mealSort, meals, foodMap]);

  const totals = useMemo(() => dayTotals(meals, foodMap), [meals, foodMap]);
  const cur = currency ?? resolveCurrency(null);
  const isToday = date === today;
  const step = waterUnit === "liters" ? 0.25 : 1;
  const unitLabel = waterUnit === "liters" ? "L" : waterUnit === "oz" ? "oz" : "glasses";

  const weekStart = startOfWeekKey(today);
  const weekSpend = useMemo(() => Math.round((all?.meals ?? []).filter((m) => m.date >= weekStart && m.date <= today).reduce((s, m) => s + mealTotals(m, foodMap).cost, 0) * 100) / 100, [all, weekStart, today, foodMap]);

  const hs = healthScore({ water, waterTarget, mealCount: meals.length, protein: totals.protein, proteinTarget });
  const hm = healthMeta(hs);

  // Overall completion of today's goals
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const overall = useMemo(() => {
    const parts = [calorieTarget ? totals.calories / calorieTarget : 0, proteinTarget ? totals.protein / proteinTarget : 0, waterTarget ? water / waterTarget : 0].map(clamp01);
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  }, [calorieTarget, totals.calories, proteinTarget, totals.protein, waterTarget, water]);

  // Last 7 days for charts
  const week = useMemo(() => {
    const keys = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
    return keys.map((k) => {
      const dm = (all?.meals ?? []).filter((m) => m.date === k);
      const t = dayTotals(dm, foodMap);
      const log = (all?.logs ?? []).find((l) => l.date === k);
      return { key: k, calories: t.calories, protein: t.protein, cost: t.cost, water: log?.water ?? 0 };
    });
  }, [all, today, foodMap]);

  const activeFoods = useMemo(() => (all?.foods ?? []).filter((f) => !f.archived), [all]);
  const favFoods = useMemo(() => activeFoods.filter((f) => f.favorite).slice(0, 6), [activeFoods]);
  const recentFoods = useMemo(() => [...activeFoods].filter((f) => !f.favorite).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [activeFoods]);
  const foodResults = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    return q ? activeFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [activeFoods, foodQuery]);

  const pantryTop = useMemo(() => [...(all?.pantry ?? [])].sort((a, b) => (a.expirationDate ?? "9999") < (b.expirationDate ?? "9999") ? -1 : 1).slice(0, 4), [all]);
  const shoppingTop = useMemo(() => (all?.shopping ?? []).slice(0, 6), [all]);
  const recommended = useMemo(() => [...(all?.recipes ?? [])].filter((r) => !r.archived && r.items.length > 0).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt).slice(0, 4), [all]);

  // "What should I eat next?" — recipes that fit the remaining calories.
  const suggestions = useMemo(() => {
    if (!calorieTarget || meals.length === 0) return null;
    const remaining = calorieTarget - totals.calories;
    if (remaining < 100) return null;
    const fits = (all?.recipes ?? [])
      .filter((r) => !r.archived && r.items.length > 0)
      .map((r) => ({ r, cal: recipeTotals(r, foodMap).calories }))
      .filter((x) => x.cal > 0 && x.cal >= remaining * 0.4 && x.cal <= remaining * 1.15)
      .sort((a, b) => Math.abs(a.cal - remaining) - Math.abs(b.cal - remaining))
      .slice(0, 4)
      .map((x) => ({ recipe: x.r, perfect: Math.abs(x.cal - remaining) <= remaining * 0.15 }));
    return fits.length ? { remaining: Math.round(remaining), fits } : null;
  }, [all, calorieTarget, meals.length, totals.calories, foodMap]);

  function patchLog(patch: Partial<{ water: number; waterTarget: number }>) {
    if (!user) return;
    setAll((prev) => {
      if (!prev) return prev;
      const logs = [...prev.logs];
      const i = logs.findIndex((l) => l.date === date);
      if (i >= 0) logs[i] = { ...logs[i], ...patch };
      else logs.push({ id: `${user.uid}_${date}`, userId: user.uid, date, water: 0, waterTarget, breakfast: false, lunch: false, dinner: false, calories: null, protein: null, carbs: null, fat: null, cost: null, notes: null, createdAt: 0, ...patch });
      return { ...prev, logs };
    });
    void upsertNutritionLog(user.uid, date, patch).catch(() => void load({ quiet: true }));
  }
  function changeWater(next: number) {
    patchLog({ water: Math.max(0, Math.round(next * 100) / 100) });
  }
  function commit(field: "protein" | "calorie" | "budget" | "waterTarget", n: number) {
    if (!user) return;
    if (field === "protein") { setProteinTarget(n); void upsertPrefs(user.uid, { proteinTarget: n }); }
    else if (field === "calorie") { setCalorieTarget(n); void upsertPrefs(user.uid, { calorieTarget: n }); }
    else if (field === "budget") { setWeeklyBudget(n); void upsertPrefs(user.uid, { foodBudgetWeekly: n }); }
    else patchLog({ waterTarget: n });
  }
  function addQuickFood(f: FoodItem) {
    const serving = f.servings[0] ?? { id: genId(), label: `100 ${f.unit}`, grams: 100 };
    setDialog({ open: true, meal: null, seed: [foodToEntry(f, serving, 1, 0)] });
  }
  async function quickLogRecipe(r: Recipe) {
    if (!user) return;
    await createNutritionMeal(user.uid, date, { name: r.name, icon: r.kind === "template" ? "🍽️" : "🥘", color: "#10b981", time: null, notes: null, items: r.items.map((e, i) => ({ ...e, id: genId(), sortOrder: i })), calories: null, protein: null, carbs: null, fat: null, cost: null });
    await load({ quiet: true, sync: true });
  }
  async function duplicate(m: NutritionMeal) {
    if (!user) return;
    await createNutritionMeal(user.uid, date, { name: `${m.name} (copy)`, icon: m.icon, color: m.color, time: m.time, notes: m.notes, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, cost: m.cost, items: m.items, sortOrder: meals.length });
    await load({ quiet: true, sync: true });
  }
  async function remove(m: NutritionMeal) {
    setAll((prev) => (prev ? { ...prev, meals: prev.meals.filter((x) => x.id !== m.id) } : prev));
    await deleteNutritionMeal(m.id);
    await load({ quiet: true, sync: true });
  }
  async function toggleShop(item: ShoppingItem) {
    setAll((prev) => (prev ? { ...prev, shopping: prev.shopping.map((s) => (s.id === item.id ? { ...s, purchased: !s.purchased } : s)) } : prev));
    await updateShoppingItem(item.id, { purchased: !item.purchased });
  }
  async function addShop() {
    if (!user || !newShop.trim()) return;
    const name = newShop.trim();
    setNewShop("");
    await createShoppingItem(user.uid, { foodId: null, name, unit: null, quantity: null, estCost: null, sortOrder: (all?.shopping.length ?? 0) });
    await load({ quiet: true });
  }
  function dropOn(targetId: string) {
    if (mealSort !== "custom" || !dragId || dragId === targetId) { setDragId(null); return; }
    const ids = meals.map((m) => m.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, dragId);
    const byId = new Map(meals.map((m) => [m.id, m]));
    const reordered = ids.map((id, i) => ({ ...byId.get(id)!, sortOrder: i }));
    setAll((prev) => (prev ? { ...prev, meals: [...prev.meals.filter((m) => m.date !== date), ...reordered] } : prev));
    void reorderNutritionMeals(ids);
    setDragId(null);
  }

  const name = resolveFirstName(displayName, user?.email);
  const greet = greetingFor(new Date().getHours());
  const greetSep = /[?!.]$/.test(greet) ? "" : ",";

  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
      <NutritionNav />

      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{greet}{greetSep} {name} 👋</h1>
          <p className="mt-1.5 text-muted-foreground">Today&apos;s goal: <span className="text-foreground">{fmt(calorieTarget)} kcal</span> · <span className="text-foreground">{proteinTarget}g protein</span> · <span className="text-foreground">{waterTarget}{unitLabel === "glasses" ? "" : unitLabel} water</span></p>
          {!loading && <p className="mt-1 text-sm text-muted-foreground">You&apos;ve completed <span className="font-semibold text-foreground">{overall}%</span> of today&apos;s nutrition.</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/40 px-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" onClick={() => setDate(today)} className="flex min-w-[120px] items-center justify-center gap-1.5 text-center text-sm font-medium"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{isToday ? "Today" : formatLongDate(date)}</button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button size="lg" onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add meal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6"><SkeletonCard lines={3} /><SkeletonCard lines={8} /></div>
      ) : (
        <>
          {/* Today's Progress */}
          <Card className={cn(soft, "p-6")}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex-1">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s Progress</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                  <ProgressStat emoji="🔥" label="Calories" value={fmt(totals.calories)} goal={`/ ${fmt(calorieTarget)}`} pct={calorieTarget ? (totals.calories / calorieTarget) * 100 : 0} bar="bg-violet-500" />
                  <ProgressStat emoji="🥩" label="Protein" value={`${totals.protein}`} goal={`/ ${proteinTarget}g`} pct={proteinTarget ? (totals.protein / proteinTarget) * 100 : 0} bar="bg-fuchsia-500" />
                  <ProgressStat emoji="💧" label="Water" value={`${water}`} goal={`/ ${waterTarget}${unitLabel === "glasses" ? "" : unitLabel}`} pct={waterTarget ? (water / waterTarget) * 100 : 0} bar="bg-sky-500"
                    barOverride={<WaterSegments water={water} target={waterTarget} step={step} onSet={changeWater} />}
                    controls={
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => changeWater(water - step)} disabled={water <= 0} className="flex h-5 w-5 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition hover:bg-accent disabled:opacity-40" aria-label="Less water"><Minus className="h-3 w-3" /></button>
                        <button type="button" onClick={() => changeWater(water + step)} className="flex h-5 w-5 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition hover:bg-accent" aria-label="More water"><Plus className="h-3 w-3" /></button>
                      </span>
                    } />
                  <ProgressStat emoji="❤️" label="Health" value={`${hs}`} goal="/ 100" pct={hs} barStyle={hm.color} />
                  <ProgressStat emoji="💰" label="Food Cost" value={formatAmount(totals.cost, cur)} goal="today" pct={weeklyBudget ? (weekSpend / weeklyBudget) * 100 : 0} bar="bg-emerald-500" />
                </div>
                {(totals.protein > 0 || totals.carbs > 0 || totals.fat > 0) && (
                  <div className="mt-4 border-t border-border/40 pt-4">
                    <MacroSplit protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                  <span className="font-medium">Goals</span>
                  <label className="flex items-center gap-1">Calories <NumberField value={calorieTarget} onCommit={(n) => commit("calorie", n)} min={0} aria-label="Calorie goal" inputClassName="w-14" /></label>
                  <label className="flex items-center gap-1">Protein <NumberField value={proteinTarget} onCommit={(n) => commit("protein", n)} min={0} aria-label="Protein goal" inputClassName="w-12" />g</label>
                  <label className="flex items-center gap-1">Water <NumberField value={waterTarget} onCommit={(n) => commit("waterTarget", n)} min={1} decimals={waterUnit === "liters"} aria-label="Water goal" inputClassName="w-12" />{unitLabel === "glasses" ? "" : unitLabel}</label>
                  <label className="flex items-center gap-1">Budget/wk <NumberField value={weeklyBudget ?? 0} onCommit={(n) => commit("budget", n)} min={0} aria-label="Weekly budget" inputClassName="w-14" /></label>
                </div>
              </div>
              <div className="flex items-center justify-center border-t border-border/40 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <NutritionRings
                  center={{ value: `${overall}%`, label: "goals" }}
                  rings={[
                    { label: "Calories", pct: calorieTarget ? (totals.calories / calorieTarget) * 100 : 0, color: "#8b5cf6" },
                    { label: "Protein", pct: proteinTarget ? (totals.protein / proteinTarget) * 100 : 0, color: "#d946ef" },
                    { label: "Water", pct: waterTarget ? (water / waterTarget) * 100 : 0, color: "#0ea5e9" },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Dominant timeline + right rail */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Timeline */}
            <div className="space-y-6">
              <Card className={cn(soft, "overflow-hidden")}>
                <div className="flex items-center justify-between px-5 py-4">
                  <h2 className="text-lg font-semibold">Today&apos;s Timeline {meals.length > 0 && <span className="text-sm font-normal text-muted-foreground">· {meals.length}</span>}</h2>
                  <Select value={mealSort} onValueChange={(v) => setMealSort(v as "group" | "time" | "custom")}>
                    <SelectTrigger className="h-8 w-[150px] border-border/40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="group">Group by meal</SelectItem><SelectItem value="time">Sort by time</SelectItem><SelectItem value="custom">Custom order</SelectItem></SelectContent>
                  </Select>
                </div>
                {meals.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
                    <span className="text-5xl">🍳</span>
                    <div>
                      <p className="text-lg font-medium">Nothing logged today</p>
                      <p className="mt-1 text-sm text-muted-foreground">Start by adding your first meal — search a food and you&apos;re done.</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add meal</Button>
                      <Button variant="outline" onClick={() => router.push("/nutrition/foods")}>Browse foods</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {sections ? (
                      <div className="border-t border-border/40">
                        {sections.map((s) => (
                          <div key={s.key}>
                            <div className="flex items-center justify-between bg-muted/20 px-5 py-2">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="text-sm">{s.emoji}</span> {s.label}</p>
                              <p className="text-xs tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{s.calories} kcal</span> · {s.protein}g protein</p>
                            </div>
                            <div className="divide-y divide-border/40 border-t border-border/40">
                              {s.meals.map((m) => (
                                <MealRow key={m.id} meal={m} foods={foodMap} currency={cur} dragging={dragId === m.id}
                                  onEdit={() => setDialog({ open: true, meal: m })} onDuplicate={() => duplicate(m)} onDelete={() => remove(m)}
                                  onDragStart={() => setDragId(m.id)} onDragEnd={() => setDragId(null)}
                                  onDragOver={(e) => { if (mealSort === "custom" && dragId) e.preventDefault(); }}
                                  onDrop={(e) => { e.preventDefault(); dropOn(m.id); }} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40 border-t border-border/40">
                        {meals.map((m) => (
                          <MealRow key={m.id} meal={m} foods={foodMap} currency={cur} dragging={dragId === m.id}
                            onEdit={() => setDialog({ open: true, meal: m })} onDuplicate={() => duplicate(m)} onDelete={() => remove(m)}
                            onDragStart={() => setDragId(m.id)} onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => { if (mealSort === "custom" && dragId) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); dropOn(m.id); }} />
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setDialog({ open: true, meal: null })} className="flex w-full items-center justify-center gap-1.5 border-t border-border/40 py-3 text-sm font-medium text-primary transition hover:bg-primary/5">
                      <Plus className="h-4 w-4" /> Add meal
                    </button>
                  </>
                )}
              </Card>

              {/* This week */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">This week</h2>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <WeekChart title="Calories" data={week.map((d) => d.calories)} labels={week.map((d) => d.key)} bar="bg-violet-500" />
                  <WeekChart title="Protein" data={week.map((d) => d.protein)} labels={week.map((d) => d.key)} bar="bg-fuchsia-500" suffix="g" />
                  <WeekChart title="Water" data={week.map((d) => d.water)} labels={week.map((d) => d.key)} bar="bg-sky-500" />
                  <WeekChart title="Spending" data={week.map((d) => d.cost)} labels={week.map((d) => d.key)} bar="bg-emerald-500" money={cur} />
                </div>
              </div>

              {/* Recommended / calorie-fit suggestions */}
              {(suggestions ? suggestions.fits.length > 0 : recommended.length > 0) && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    {suggestions ? <>🎯 Fits your remaining ~{fmt(suggestions.remaining)} kcal</> : "Recommended for you"}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {(suggestions ? suggestions.fits : recommended.map((r) => ({ recipe: r, perfect: false }))).map(({ recipe: r, perfect }) => {
                      const rt = recipeTotals(r, foodMap);
                      return (
                        <Card key={r.id} className={cn(soft, "flex flex-col overflow-hidden")}>
                          <div className="relative flex h-24 items-center justify-center bg-muted text-3xl">
                            {r.imageData ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageData} alt="" className="h-full w-full object-cover" />
                            ) : (r.kind === "template" ? "🍽️" : "🥘")}
                            {r.prepMinutes != null && (
                              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"><Clock className="h-3 w-3" /> {r.prepMinutes} min</span>
                            )}
                            {perfect && (
                              <span className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">Perfect fit</span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-1.5 p-3">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">{rt.calories} kcal · {rt.protein}g P · {formatAmount(rt.cost, cur)}</p>
                            <Button size="sm" variant="outline" className="mt-auto h-8 w-full text-xs" onClick={() => quickLogRecipe(r)}><Plus className="h-3.5 w-3.5" /> Add to today</Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right rail */}
            <div className="space-y-6">
              {/* Quick add */}
              <Card className={cn(soft, "space-y-4 p-5")}>
                <p className="font-semibold">Quick Add</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder="Search foods…" className="border-border/40 pl-8" />
                </div>
                {foodQuery.trim() ? (
                  <FoodList foods={foodResults} onPick={addQuickFood} empty="No matching foods." />
                ) : activeFoods.length === 0 ? (
                  <button type="button" onClick={() => router.push("/nutrition/foods")} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground transition hover:bg-accent"><Utensils className="h-4 w-4" /> Add foods to quick-log them</button>
                ) : (
                  <div className="space-y-3">
                    {favFoods.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Favorites</p>
                        <FoodList foods={favFoods} onPick={addQuickFood} />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
                      <FoodList foods={recentFoods} onPick={addQuickFood} />
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => router.push("/nutrition/foods")} className="flex w-full items-center justify-center gap-1 rounded-lg border border-border/40 py-2 text-center text-xs font-medium text-muted-foreground transition hover:bg-accent">View all foods <ArrowRight className="h-3 w-3" /></button>
              </Card>

              {/* Pantry */}
              <Card className={cn(soft, "space-y-3 p-5")}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Pantry</p>
                  <button type="button" onClick={() => router.push("/nutrition/pantry")} className="text-xs text-primary hover:underline">View all</button>
                </div>
                {pantryTop.length > 0 ? (
                  <div className="space-y-2">
                    {pantryTop.map((p) => {
                      const exp = expiryStatus(p, today);
                      const d = p.expirationDate ? daysBetween(today, p.expirationDate) : null;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.quantityRemaining}{p.unit}{stockStatus(p) !== "ok" && <span className="text-amber-500"> · low</span>}{d != null && (exp === "soon" || exp === "expired") && <span className={exp === "expired" ? "text-rose-500" : "text-amber-500"}> · {d < 0 ? "exp" : `${d}d`}</span>}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button type="button" onClick={() => router.push("/nutrition/pantry")} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground transition hover:bg-accent"><Package className="h-4 w-4" /> Track what&apos;s in your pantry</button>
                )}
              </Card>

              {/* Shopping */}
              <Card className={cn(soft, "space-y-2.5 p-5")}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Shopping List</p>
                  <button type="button" onClick={() => router.push("/nutrition/shopping")} className="text-xs text-primary hover:underline">View all</button>
                </div>
                {shoppingTop.length > 0 && (
                  <div className="space-y-1">
                    {shoppingTop.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                        <Checkbox checked={s.purchased} onCheckedChange={() => toggleShop(s)} aria-label={s.name} />
                        <span className={cn("min-w-0 flex-1 truncate", s.purchased && "text-muted-foreground line-through")}>{s.name}</span>
                        {s.quantity != null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.quantity}{s.unit ?? ""}</span>}
                      </label>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={newShop} onChange={(e) => setNewShop(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addShop(); }} placeholder="Add item…" className="border-border/40 pl-8" />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {user && (
        <MealDialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))} userId={user.uid} date={date} meal={dialog.meal} seedItems={dialog.seed} foods={all?.foods ?? []} currency={cur} onManageFoods={() => router.push("/nutrition/foods")} onSaved={() => load({ quiet: true, sync: true })} />
      )}
    </div>
  );
}

function ProgressStat({ emoji, label, value, goal, pct, bar, barStyle, controls, barOverride }: { emoji: string; label: string; value: string; goal: string; pct: number; bar?: string; barStyle?: string; controls?: React.ReactNode; barOverride?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><span>{emoji}</span> {label}</span>
        {controls}
      </div>
      <p className="text-xl font-bold tabular-nums leading-none">{value}<span className="ml-1 text-xs font-normal text-muted-foreground">{goal}</span></p>
      {barOverride ?? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, pct))}%`, ...(barStyle ? { backgroundColor: barStyle } : {}) }} />
        </div>
      )}
    </div>
  );
}

/** Tappable water segments — one per glass / 0.25L. Click a segment to fill up
 * to it; click the current level to step back down. Falls back to a plain bar
 * when the target would need too many segments to read comfortably. */
function WaterSegments({ water, target, step, onSet }: { water: number; target: number; step: number; onSet: (v: number) => void }) {
  const count = Math.round(target / step);
  if (count < 2 || count > 16) {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (water / (target || 1)) * 100)}%` }} />
      </div>
    );
  }
  const filled = Math.round(water / step);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => {
        const level = Math.round((i + 1) * step * 100) / 100;
        const isFilled = i < filled;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Set water to ${level}`}
            onClick={() => onSet(isFilled && filled === i + 1 ? Math.round((level - step) * 100) / 100 : level)}
            className={cn("h-2.5 flex-1 rounded-sm transition-colors", isFilled ? "bg-sky-500 hover:bg-sky-400" : "bg-muted hover:bg-sky-500/30")}
          />
        );
      })}
    </div>
  );
}

/** Where today's calories come from — protein/carbs/fat split with % labels. */
function MacroSplit({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const kcal = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total <= 0) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const parts = [
    { label: "Protein", grams: protein, pct: pct(kcal.protein), color: "bg-fuchsia-500", text: "text-fuchsia-500" },
    { label: "Carbs", grams: carbs, pct: pct(kcal.carbs), color: "bg-amber-500", text: "text-amber-500" },
    { label: "Fat", grams: fat, pct: pct(kcal.fat), color: "bg-sky-500", text: "text-sky-500" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((p) => p.pct > 0 && <div key={p.label} className={cn("h-full", p.color)} style={{ width: `${p.pct}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", p.color)} />
            {p.label} <span className="font-semibold text-foreground">{p.grams}g</span> · {p.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 100 ? "#10b981" : "#8b5cf6";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value}%</span>
        <span className="text-[10px] text-muted-foreground">of goals</span>
      </div>
    </div>
  );
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
function WeekChart({ title, data, labels, bar, suffix, money }: { title: string; data: number[]; labels: string[]; bar: string; suffix?: string; money?: Currency }) {
  const max = Math.max(1, ...data);
  const hasData = data.some((v) => v > 0);
  const todayIdx = data.length - 1;
  const latest = data[todayIdx] ?? 0;
  return (
    <Card className={cn(soft, "space-y-3 p-4")}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm font-semibold tabular-nums">{money ? formatAmount(latest, money) : `${latest}${suffix ?? ""}`}</p>
      </div>
      <div className="flex h-16 items-end gap-1">
        {data.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${labels[i]}: ${money ? formatAmount(v, money) : v}${suffix ?? ""}`}>
            <div className="flex w-full flex-1 items-end">
              <div className={cn("w-full rounded-t-sm transition-all", i === todayIdx ? bar : `${bar} opacity-40`)} style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%` }} />
            </div>
            <span className={cn("text-[9px]", i === todayIdx ? "font-semibold text-foreground" : "text-muted-foreground")}>{DOW[new Date(labels[i] + "T00:00:00").getDay()]}</span>
          </div>
        ))}
      </div>
      {!hasData && <p className="text-center text-[11px] text-muted-foreground">No data yet</p>}
    </Card>
  );
}

function FoodList({ foods, onPick, empty }: { foods: FoodItem[]; onPick: (f: FoodItem) => void; empty?: string }) {
  if (foods.length === 0) return empty ? <p className="text-xs text-muted-foreground">{empty}</p> : null;
  return (
    <div className="space-y-0.5">
      {foods.map((f) => (
        <button key={f.id} type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {f.imageData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.imageData} alt="" className="h-full w-full object-cover" />
            ) : f.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
