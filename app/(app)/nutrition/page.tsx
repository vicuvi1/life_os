"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Minus, GlassWater, Beef, Flame, Wallet, HeartPulse,
  Search, Package, Utensils, CalendarDays,
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
import { DEFAULT_WATER_TARGET, DEFAULT_PROTEIN_TARGET, healthScore, healthMeta } from "@/lib/nutrition";
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
import type { NutritionMeal, Recipe, FoodItem, ShoppingItem } from "@/lib/types";

const DEFAULT_CAL_TARGET = 2000;
const fmt = (n: number) => n.toLocaleString("en-US");

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
  const [water, setWaterState] = useState(0);
  const [waterTarget, setWaterTargetState] = useState(DEFAULT_WATER_TARGET);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; meal: NutritionMeal | null }>({ open: false, meal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [mealSort, setMealSort] = useState<"time" | "custom">("time");
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
        const meals = data.meals.filter((m) => m.date === date);
        void upsertNutritionLog(user.uid, date, dayTotals(meals, toFoodMap(data.foods))).catch(() => {});
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user, date]);

  useEffect(() => { load(); }, [load]);

  const foodMap = useMemo(() => toFoodMap(all?.foods ?? []), [all]);
  const meals = useMemo(() => {
    const list = (all?.meals ?? []).filter((m) => m.date === date);
    if (mealSort === "time") return list.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.sortOrder - b.sortOrder);
    return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }, [all, date, mealSort]);
  const dayLog = useMemo(() => (all?.logs ?? []).find((l) => l.date === date) ?? null, [all, date]);

  useEffect(() => {
    setWaterState(dayLog?.water ?? 0);
    setWaterTargetState(dayLog?.waterTarget ?? DEFAULT_WATER_TARGET);
  }, [dayLog]);

  const totals = useMemo(() => dayTotals(meals, foodMap), [meals, foodMap]);
  const cur = currency ?? resolveCurrency(null);
  const isToday = date === today;
  const step = waterUnit === "liters" ? 0.25 : 1;
  const unitLabel = waterUnit === "liters" ? "L" : waterUnit === "oz" ? "oz" : "glasses";

  const weekStart = startOfWeekKey(today);
  const weekSpend = useMemo(() => Math.round((all?.meals ?? []).filter((m) => m.date >= weekStart && m.date <= today).reduce((s, m) => s + mealTotals(m, foodMap).cost, 0) * 100) / 100, [all, weekStart, today, foodMap]);

  const hs = healthScore({ water, waterTarget, mealCount: meals.length, protein: totals.protein, proteinTarget });
  const hm = healthMeta(hs);

  const quickFoods = useMemo(() => {
    const active = (all?.foods ?? []).filter((f) => !f.archived);
    const q = foodQuery.trim().toLowerCase();
    const base = q ? active.filter((f) => f.name.toLowerCase().includes(q)) : [...active].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt);
    return base.slice(0, 6);
  }, [all, foodQuery]);

  const pantryTop = useMemo(() => [...(all?.pantry ?? [])].sort((a, b) => (a.expirationDate ?? "9999") < (b.expirationDate ?? "9999") ? -1 : 1).slice(0, 4), [all]);
  const shoppingTop = useMemo(() => (all?.shopping ?? []).slice(0, 6), [all]);
  const recommended = useMemo(() => [...(all?.recipes ?? [])].filter((r) => !r.archived && r.items.length > 0).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt).slice(0, 4), [all]);

  const insight = useMemo(() => {
    const left = Math.max(0, Math.round(proteinTarget - totals.protein));
    if (meals.length === 0) return null;
    if (left > 5) {
      const pf = (all?.pantry ?? []).filter((p) => p.quantityRemaining > 0 && (foodMap.get(p.foodId ?? "")?.protein ?? 0) >= 15).map((p) => p.name);
      return `🥚 You still need about ${left}g of protein today.${pf.length ? ` You have ${pf.slice(0, 2).join(" and ")} in your pantry.` : ""}`;
    }
    return null;
  }, [meals.length, proteinTarget, totals.protein, all, foodMap]);

  function changeWater(next: number) {
    if (!user) return;
    const clamped = Math.max(0, Math.round(next * 100) / 100);
    setWaterState(clamped);
    setAll((prev) => {
      if (!prev) return prev;
      const logs = [...prev.logs];
      const i = logs.findIndex((l) => l.date === date);
      if (i >= 0) logs[i] = { ...logs[i], water: clamped };
      else logs.push({ id: `${user.uid}_${date}`, userId: user.uid, date, water: clamped, waterTarget, breakfast: false, lunch: false, dinner: false, calories: null, protein: null, carbs: null, fat: null, cost: null, notes: null, createdAt: 0 });
      return { ...prev, logs };
    });
    void upsertNutritionLog(user.uid, date, { water: clamped }).catch(() => void load({ quiet: true }));
  }
  function commit(field: "protein" | "calorie" | "budget" | "waterTarget", n: number) {
    if (!user) return;
    if (field === "protein") { setProteinTarget(n); void upsertPrefs(user.uid, { proteinTarget: n }); }
    else if (field === "calorie") { setCalorieTarget(n); void upsertPrefs(user.uid, { calorieTarget: n }); }
    else if (field === "budget") { setWeeklyBudget(n); void upsertPrefs(user.uid, { foodBudgetWeekly: n }); }
    else { setWaterTargetState(n); void upsertNutritionLog(user.uid, date, { waterTarget: n }).catch(() => void load({ quiet: true })); }
  }

  async function addQuickFood(f: FoodItem) {
    if (!user) return;
    const serving = f.servings[0] ?? { id: genId(), label: `100 ${f.unit}`, grams: 100 };
    await createNutritionMeal(user.uid, date, { name: f.name, icon: "🍽️", color: "#6366f1", time: null, notes: null, items: [foodToEntry(f, serving, 1, 0)], calories: null, protein: null, carbs: null, fat: null, cost: null });
    await load({ quiet: true, sync: true });
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

  const calLeft = calorieTarget - totals.calories;
  const proteinLeft = proteinTarget - totals.protein;
  const waterLeft = Math.round((waterTarget - water) * 100) / 100;
  const budgetLeft = weeklyBudget ? Math.round((weeklyBudget - weekSpend) * 100) / 100 : null;
  const name = resolveFirstName(displayName, user?.email);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <NutritionNav />

      {/* Greeting header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{greetingFor(new Date().getHours())}, {name}! 👋</h1>
          <p className="text-muted-foreground">Stay consistent with your nutrition and hit your goals.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" onClick={() => setDate(today)} className="flex min-w-[120px] items-center justify-center gap-1.5 text-center text-sm font-medium"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{isToday ? "Today" : formatLongDate(date)}</button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add meal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={6} /></div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric icon={<Flame className="h-3.5 w-3.5" />} label="Calories" tone="text-amber-500"
              main={<>{fmt(totals.calories)} <span className="text-sm font-normal text-muted-foreground">/ {fmt(calorieTarget)} kcal</span></>}
              pct={calorieTarget ? (totals.calories / calorieTarget) * 100 : 0} bar="bg-violet-500"
              sub={calLeft >= 0 ? `${fmt(calLeft)} kcal left` : `${fmt(-calLeft)} kcal over`}
              editor={<NumberField value={calorieTarget} onCommit={(n) => commit("calorie", n)} min={0} aria-label="Calorie goal" inputClassName="w-14" />} />
            <Metric icon={<Beef className="h-3.5 w-3.5" />} label="Protein" tone="text-fuchsia-500"
              main={<>{totals.protein} <span className="text-sm font-normal text-muted-foreground">/ {proteinTarget} g</span></>}
              pct={proteinTarget ? (totals.protein / proteinTarget) * 100 : 0} bar="bg-fuchsia-500"
              sub={proteinLeft > 0 ? `${Math.round(proteinLeft)} g left` : "goal reached 🎉"}
              editor={<NumberField value={proteinTarget} onCommit={(n) => commit("protein", n)} min={0} aria-label="Protein goal" inputClassName="w-12" />} />
            <Metric icon={<GlassWater className="h-3.5 w-3.5" />} label="Water" tone="text-sky-500"
              main={<>{water} <span className="text-sm font-normal text-muted-foreground">/ {waterTarget} {unitLabel}</span></>}
              pct={waterTarget ? (water / waterTarget) * 100 : 0} bar="bg-sky-500"
              sub={waterLeft > 0 ? `${waterLeft} ${unitLabel} left` : "goal reached 🎉"}
              footer={
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeWater(water - step)} disabled={water <= 0} aria-label="Less water"><Minus className="h-3 w-3" /></Button>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeWater(water + step)} aria-label="More water"><Plus className="h-3 w-3" /></Button>
                </div>
              } />
            <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Food Cost" tone="text-emerald-500"
              main={<>{formatAmount(totals.cost, cur)} <span className="text-sm font-normal text-muted-foreground">today</span></>}
              pct={weeklyBudget ? (weekSpend / weeklyBudget) * 100 : 0} bar={weeklyBudget && weekSpend > weeklyBudget ? "bg-rose-500" : "bg-emerald-500"}
              sub={budgetLeft != null ? `${formatAmount(Math.max(0, budgetLeft), cur)} left this week` : `${formatAmount(weekSpend, cur)} this week`}
              editor={<NumberField value={weeklyBudget ?? 0} onCommit={(n) => commit("budget", n)} min={0} aria-label="Weekly budget" inputClassName="w-14" />} />
            {/* Health */}
            <Card className="col-span-2 flex flex-col justify-between p-4 sm:col-span-1">
              <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Health Score</span></p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">{hs}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                <Badge variant={hs >= 65 ? "success" : hs >= 40 ? "warning" : "destructive"}>{hm.label}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{hs >= 85 ? "Crushing it 💪" : hs >= 65 ? "Keep it up! 💪" : hs >= 40 ? "You can do better 🙂" : "Let's turn it around"}</p>
            </Card>
          </div>

          {insight && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">{insight}</div>
          )}

          {/* Two columns */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left: meals + recommended */}
            <div className="space-y-4 lg:col-span-2">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="font-semibold">Today&apos;s Meals {meals.length > 0 && <span className="text-sm font-normal text-muted-foreground">· {meals.length}</span>}</h2>
                  <Select value={mealSort} onValueChange={(v) => setMealSort(v as "time" | "custom")}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="time">Sort by time</SelectItem><SelectItem value="custom">Custom order</SelectItem></SelectContent>
                  </Select>
                </div>
                {meals.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <Utensils className="h-7 w-7 text-muted-foreground" />
                    <p className="font-medium">No meals logged {isToday ? "yet" : "this day"}</p>
                    <p className="max-w-xs text-sm text-muted-foreground">Search a food to log it — the name and details are optional.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {meals.map((m) => (
                      <MealRow key={m.id} meal={m} foods={foodMap} currency={cur} dragging={dragId === m.id}
                        onEdit={() => setDialog({ open: true, meal: m })} onDuplicate={() => duplicate(m)} onDelete={() => remove(m)}
                        onDragStart={() => setDragId(m.id)} onDragEnd={() => setDragId(null)}
                        onDragOver={(e) => { if (mealSort === "custom" && dragId) e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); dropOn(m.id); }} />
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setDialog({ open: true, meal: null })} className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-sm font-medium text-primary transition hover:bg-primary/5">
                  <Plus className="h-4 w-4" /> Add meal
                </button>
              </Card>

              {/* Recommended */}
              {recommended.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Recommended for you</h2>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {recommended.map((r) => {
                      const rt = recipeTotals(r, foodMap);
                      return (
                        <Card key={r.id} className="flex flex-col overflow-hidden">
                          <div className="flex h-20 items-center justify-center bg-muted text-3xl">
                            {r.imageData ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageData} alt="" className="h-full w-full object-cover" />
                            ) : (r.kind === "template" ? "🍽️" : "🥘")}
                          </div>
                          <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">{rt.calories} kcal · {rt.protein}g P · {formatAmount(rt.cost, cur)}</p>
                            <Button size="sm" variant="outline" className="mt-auto h-7 w-full text-xs" onClick={() => quickLogRecipe(r)}><Plus className="h-3.5 w-3.5" /> Add to today</Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              {/* Quick add food */}
              <Card className="space-y-3 p-4">
                <p className="font-semibold">Quick Add Food</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder="Search foods…" className="pl-8" />
                </div>
                {quickFoods.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {quickFoods.map((f) => (
                      <button key={f.id} type="button" onClick={() => addQuickFood(f)} className="flex flex-col items-center gap-1 rounded-lg border p-2 transition hover:bg-accent" title={`Add ${f.name}`}>
                        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {f.imageData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.imageData} alt="" className="h-full w-full object-cover" />
                          ) : f.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="w-full truncate text-center text-[11px]">{f.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{foodQuery ? "No matching foods." : "Add foods to your library to quick-log them."}</p>
                )}
                <button type="button" onClick={() => router.push("/nutrition/foods")} className="w-full rounded-lg border py-1.5 text-center text-xs font-medium text-muted-foreground transition hover:bg-accent">View all foods</button>
              </Card>

              {/* Pantry overview */}
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Pantry Overview</p>
                  <button type="button" onClick={() => router.push("/nutrition/pantry")} className="text-xs text-primary hover:underline">View all</button>
                </div>
                {pantryTop.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {pantryTop.map((p) => {
                      const exp = expiryStatus(p, today);
                      const d = p.expirationDate ? daysBetween(today, p.expirationDate) : null;
                      return (
                        <div key={p.id} className="rounded-lg border p-2">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] tabular-nums text-muted-foreground">{p.quantityRemaining} {p.unit} left{stockStatus(p) !== "ok" && <span className="text-amber-500"> · low</span>}</p>
                          {d != null && <p className={cn("text-[11px]", exp === "expired" ? "text-rose-500" : exp === "soon" ? "text-amber-500" : "text-muted-foreground")}>{d < 0 ? "expired" : d === 0 ? "expires today" : `expires in ${d}d`}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button type="button" onClick={() => router.push("/nutrition/pantry")} className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground transition hover:bg-accent"><Package className="h-4 w-4" /> Track what&apos;s in your pantry</button>
                )}
              </Card>

              {/* Shopping list */}
              <Card className="space-y-2 p-4">
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
                  <Input value={newShop} onChange={(e) => setNewShop(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addShop(); }} placeholder="Add item…" className="pl-8" />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {user && (
        <MealDialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))} userId={user.uid} date={date} meal={dialog.meal} foods={all?.foods ?? []} currency={cur} onManageFoods={() => router.push("/nutrition/foods")} onSaved={() => load({ quiet: true, sync: true })} />
      )}
    </div>
  );
}

function Metric({ icon, label, tone, main, pct, bar, sub, editor, footer }: { icon: React.ReactNode; label: string; tone: string; main: React.ReactNode; pct: number; bar: string; sub: string; editor?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <p className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground")}><span className={tone}>{icon}</span> {label}</p>
        {editor}
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{main}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{sub}</p>
        {footer}
      </div>
    </Card>
  );
}
