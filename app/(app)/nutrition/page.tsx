"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Minus, GlassWater, Beef, Flame, Wallet, Utensils, ShoppingCart, Zap, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionAll, upsertNutritionLog, createNutritionMeal, deleteNutritionMeal,
  reorderNutritionMeals, getPrefs, upsertPrefs, getBudget, type NutritionAll,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate, startOfWeekKey } from "@/lib/dates";
import { DEFAULT_WATER_TARGET, DEFAULT_PROTEIN_TARGET } from "@/lib/nutrition";
import { dayTotals, toFoodMap, mealTotals, genId, stockStatus, expiryStatus } from "@/lib/food";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { MealCard } from "@/components/nutrition/meal-card";
import { MealDialog } from "@/components/nutrition/meal-dialog";
import { cn } from "@/lib/utils";
import type { NutritionMeal, Recipe } from "@/lib/types";

export default function NutritionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const today = toDateKey(new Date());
  const [date, setDate] = useState(today);
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [waterUnit, setWaterUnit] = useState("glasses");
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [weeklyBudget, setWeeklyBudget] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [water, setWaterState] = useState(0);
  const [waterTarget, setWaterTargetState] = useState(DEFAULT_WATER_TARGET);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; meal: NutritionMeal | null }>({ open: false, meal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [quickLogged, setQuickLogged] = useState<Set<string>>(new Set());

  const load = useCallback(async (opts?: { quiet?: boolean; sync?: boolean; d?: string }) => {
    if (!user) return;
    const day = opts?.d ?? date;
    if (!opts?.quiet) setLoading(true);
    try {
      const [data, prefs, budget] = await Promise.all([getNutritionAll(user.uid), getPrefs(user.uid), getBudget(user.uid)]);
      setAll(data);
      setWaterUnit(prefs.waterUnit);
      setProteinTarget(prefs.proteinTarget ?? DEFAULT_PROTEIN_TARGET);
      setWeeklyBudget(prefs.foodBudgetWeekly ?? null);
      setCurrency(resolveCurrency(budget));
      if (opts?.sync) {
        const meals = data.meals.filter((m) => m.date === day);
        void upsertNutritionLog(user.uid, day, dayTotals(meals, toFoodMap(data.foods))).catch(() => {});
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user, date]);

  useEffect(() => { load({ d: date }); }, [load, date]);

  const foodMap = useMemo(() => toFoodMap(all?.foods ?? []), [all]);
  const meals = useMemo(() => (all?.meals ?? []).filter((m) => m.date === date).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt), [all, date]);
  const dayLog = useMemo(() => (all?.logs ?? []).find((l) => l.date === date) ?? null, [all, date]);

  // Sync water from the selected day's log (optimistic writes also patch `all`).
  useEffect(() => {
    setWaterState(dayLog?.water ?? 0);
    setWaterTargetState(dayLog?.waterTarget ?? DEFAULT_WATER_TARGET);
  }, [dayLog]);

  const totals = useMemo(() => dayTotals(meals, foodMap), [meals, foodMap]);
  const cur = currency ?? resolveCurrency(null);
  const isToday = date === today;
  const step = waterUnit === "liters" ? 0.25 : 1;
  const unitLabel = waterUnit === "liters" ? "L" : waterUnit === "oz" ? "oz" : "glasses";

  // Weekly spend (this calendar week)
  const weekStart = startOfWeekKey(today);
  const weekSpend = useMemo(() => Math.round((all?.meals ?? []).filter((m) => m.date >= weekStart && m.date <= today).reduce((s, m) => s + mealTotals(m, foodMap).cost, 0) * 100) / 100, [all, weekStart, today, foodMap]);

  // Quick meals — saved templates / favorite recipes with foods
  const quickMeals = useMemo(() => (all?.recipes ?? []).filter((r) => !r.archived && r.items.length > 0 && (r.kind === "template" || r.favorite)).slice(0, 4), [all]);

  // Shopping reminder — what to buy, or what's running out
  const shoppingReminder = useMemo(() => {
    const toBuy = (all?.shopping ?? []).filter((s) => !s.purchased);
    if (toBuy.length) return { kind: "shopping" as const, names: toBuy.slice(0, 5).map((s) => s.name) };
    const low = (all?.pantry ?? []).filter((p) => stockStatus(p) !== "ok" || expiryStatus(p, today) === "soon" || expiryStatus(p, today) === "expired");
    if (low.length) return { kind: "low" as const, names: low.slice(0, 5).map((p) => p.name) };
    return null;
  }, [all, today]);

  // Personality — one helpful sentence
  const insight = useMemo(() => {
    const proteinLeft = Math.max(0, Math.round(proteinTarget - totals.protein));
    if (meals.length === 0) return { emoji: "🍽️", text: "Nothing logged yet. What are you eating today?" };
    if (proteinLeft > 5) {
      const proteinFoods = (all?.pantry ?? []).filter((p) => p.quantityRemaining > 0 && (foodMap.get(p.foodId ?? "")?.protein ?? 0) >= 15).map((p) => p.name);
      let text = `You still need about ${proteinLeft}g of protein today.`;
      if (proteinFoods.length) text += ` You have ${proteinFoods.slice(0, 2).join(" and ")} in your pantry.`;
      return { emoji: "🥚", text };
    }
    if (water < waterTarget) return { emoji: "💧", text: `Protein's on track — ${Math.round((waterTarget - water) * 100) / 100} more ${unitLabel} of water to hit your goal.` };
    return { emoji: "✅", text: "You're on track for today. Nice work." };
  }, [meals.length, proteinTarget, totals.protein, all, foodMap, water, waterTarget, unitLabel]);

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
  function changeWaterTarget(next: number) {
    if (!user) return;
    setWaterTargetState(next);
    void upsertNutritionLog(user.uid, date, { waterTarget: next }).catch(() => void load({ quiet: true }));
  }
  function commitProtein(n: number) { setProteinTarget(n); if (user) void upsertPrefs(user.uid, { proteinTarget: n }); }
  function commitBudget(n: number) { setWeeklyBudget(n); if (user) void upsertPrefs(user.uid, { foodBudgetWeekly: n }); }

  async function duplicate(m: NutritionMeal) {
    if (!user) return;
    await createNutritionMeal(user.uid, date, { name: `${m.name} (copy)`, icon: m.icon, color: null, time: m.time, notes: m.notes, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, cost: m.cost, items: m.items, sortOrder: meals.length });
    await load({ quiet: true, sync: true });
  }
  async function remove(m: NutritionMeal) {
    setAll((prev) => (prev ? { ...prev, meals: prev.meals.filter((x) => x.id !== m.id) } : prev));
    await deleteNutritionMeal(m.id);
    await load({ quiet: true, sync: true });
  }
  async function quickLog(r: Recipe) {
    if (!user) return;
    setQuickLogged((s) => new Set(s).add(r.id));
    await createNutritionMeal(user.uid, date, { name: r.name, icon: r.kind === "template" ? "🍽️" : "🥘", color: null, time: null, notes: null, items: r.items.map((e, i) => ({ ...e, id: genId(), sortOrder: i })), calories: null, protein: null, carbs: null, fat: null, cost: null });
    await load({ quiet: true, sync: true });
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
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

  const waterPct = Math.min(100, (water / (waterTarget || 1)) * 100);
  const budgetPct = weeklyBudget && weeklyBudget > 0 ? Math.min(100, (weekSpend / weeklyBudget) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <NutritionNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Utensils className="h-6 w-6 text-primary" /> Today</h1>
          <p className="text-muted-foreground">{isToday ? "What are you eating today?" : "Reviewing a past day."}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" onClick={() => setDate(today)} className="min-w-[128px] text-center text-sm font-medium">{isToday ? "Today" : formatLongDate(date)}</button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add meal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={5} /></div>
      ) : (
        <>
          {/* Personality */}
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <span className="text-lg">{insight.emoji}</span>
            <p>{insight.text}</p>
          </div>

          {/* Three story cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Nutrition */}
            <Card className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Flame className="h-3.5 w-3.5" /> Nutrition</p>
              <p className="text-3xl font-bold tabular-nums">{totals.calories}<span className="ml-1 text-sm font-normal text-muted-foreground">kcal</span></p>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Beef className="h-3.5 w-3.5" /> Protein</span>
                <span className="flex items-center gap-1 tabular-nums"><span className="font-semibold">{totals.protein}g</span><span className="text-muted-foreground">/</span><NumberField value={proteinTarget} onCommit={commitProtein} min={0} max={400} aria-label="Protein goal" inputClassName="w-10" /><span className="text-muted-foreground">g</span></span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Utensils className="h-3.5 w-3.5" /> Meals</span>
                <span className="font-semibold tabular-nums">{meals.length}</span>
              </div>
            </Card>

            {/* Water */}
            <Card className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><GlassWater className="h-3.5 w-3.5" /> Water</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">goal <NumberField value={waterTarget} onCommit={changeWaterTarget} min={1} max={40} decimals={waterUnit === "liters"} aria-label="Water goal" inputClassName="w-10" /></span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{water}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {waterTarget} {unitLabel}</span></p>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${waterPct}%` }} /></div>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeWater(water - step)} disabled={water <= 0} aria-label="Less water"><Minus className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeWater(water + step)} aria-label="More water"><Plus className="h-4 w-4" /></Button>
              </div>
            </Card>

            {/* Budget */}
            <Card className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Budget</p>
              <p className="text-2xl font-bold tabular-nums">{formatAmount(totals.cost, cur)}<span className="ml-1 text-sm font-normal text-muted-foreground">today</span></p>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">This week</span>
                <span className="flex items-center gap-1 tabular-nums"><span className="font-semibold">{formatAmount(weekSpend, cur)}</span><span className="text-muted-foreground">/</span><NumberField value={weeklyBudget ?? 0} onCommit={commitBudget} min={0} aria-label="Weekly food budget" inputClassName="w-12" /></span>
              </div>
              {weeklyBudget && weeklyBudget > 0 ? (
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", weekSpend > weeklyBudget ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${budgetPct}%` }} /></div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Set a weekly budget to track it.</p>
              )}
            </Card>
          </div>

          {/* Quick meals */}
          {quickMeals.length > 0 ? (
            <div className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Zap className="h-4 w-4" /> Quick meals</h2>
              <div className="flex flex-wrap gap-2">
                {quickMeals.map((r) => (
                  <button key={r.id} type="button" onClick={() => quickLog(r)} disabled={quickLogged.has(r.id)} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition hover:bg-accent disabled:opacity-60">
                    {quickLogged.has(r.id) ? <Check className="h-4 w-4 text-emerald-500" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => router.push("/nutrition/recipes")} className="flex w-full items-center justify-between rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground transition hover:bg-accent">
              <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Save meals you eat often for one-tap logging</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {/* Today's meals */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Meals {meals.length > 0 && `· ${meals.length}`}</h2>
            {meals.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-8 text-center">
                <Utensils className="h-7 w-7 text-muted-foreground" />
                <p className="font-medium">No meals logged {isToday ? "yet" : "this day"}</p>
                <p className="max-w-xs text-sm text-muted-foreground">Just search for what you ate — the name and details are optional.</p>
                <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add a meal</Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {meals.map((m) => (
                  <MealCard
                    key={m.id}
                    meal={m}
                    foods={foodMap}
                    currency={cur}
                    dragging={dragId === m.id}
                    onEdit={() => setDialog({ open: true, meal: m })}
                    onDuplicate={() => duplicate(m)}
                    onDelete={() => remove(m)}
                    onDragStart={() => setDragId(m.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); dropOn(m.id); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Shopping reminder */}
          {shoppingReminder && (
            <button type="button" onClick={() => router.push(shoppingReminder.kind === "shopping" ? "/nutrition/shopping" : "/nutrition/pantry")} className="flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition hover:bg-accent">
              <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{shoppingReminder.kind === "shopping" ? "Shopping reminder" : "Running low"}</span>
                <span className="ml-2 text-muted-foreground">{shoppingReminder.names.join(", ")}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </>
      )}

      {user && (
        <MealDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}
          userId={user.uid}
          date={date}
          meal={dialog.meal}
          foods={all?.foods ?? []}
          currency={cur}
          onManageFoods={() => router.push("/nutrition/foods")}
          onSaved={() => load({ quiet: true, sync: true })}
        />
      )}
    </div>
  );
}
