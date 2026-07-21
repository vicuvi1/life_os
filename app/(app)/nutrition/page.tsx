"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Minus, GlassWater, Flame, Beef, Wallet, HeartPulse, Utensils, Library } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionDay, upsertNutritionLog, updateNutritionMeal, createNutritionMeal,
  deleteNutritionMeal, reorderNutritionMeals, getPrefs, upsertPrefs, getBudget, type NutritionDay,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import { DEFAULT_WATER_TARGET, DEFAULT_PROTEIN_TARGET, nutritionSummary, healthMeta } from "@/lib/nutrition";
import { dayTotals } from "@/lib/food";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MealCard } from "@/components/nutrition/meal-card";
import { MealDialog } from "@/components/nutrition/meal-dialog";
import { cn } from "@/lib/utils";
import type { NutritionMeal } from "@/lib/types";

export default function NutritionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const today = toDateKey(new Date());
  const [date, setDate] = useState(today);
  const [data, setData] = useState<NutritionDay>({ log: null, meals: [], foods: [] });
  const [waterUnit, setWaterUnit] = useState("glasses");
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; meal: NutritionMeal | null }>({ open: false, meal: null });
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async (d: string, opts?: { quiet?: boolean; sync?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [day, prefs, budget] = await Promise.all([getNutritionDay(user.uid, d), getPrefs(user.uid), getBudget(user.uid)]);
      setData(day);
      setWaterUnit(prefs.waterUnit);
      setProteinTarget(prefs.proteinTarget ?? DEFAULT_PROTEIN_TARGET);
      setCurrency(resolveCurrency(budget));
      // Roll the day's meal macros up onto the per-day log doc so the dashboard
      // and insights read live totals without loading every meal.
      if (opts?.sync) void upsertNutritionLog(user.uid, d, dayTotals(day.meals)).catch(() => {});
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(date); }, [load, date]);

  const meals = data.meals;
  const water = data.log?.water ?? 0;
  const waterTarget = data.log?.waterTarget ?? DEFAULT_WATER_TARGET;
  const summary = useMemo(() => nutritionSummary(meals, water, waterTarget, proteinTarget), [meals, water, waterTarget, proteinTarget]);
  const hm = healthMeta(summary.healthScore);
  const cur = currency ?? resolveCurrency(null);
  const step = waterUnit === "liters" ? 0.25 : 1;
  const unitLabel = waterUnit === "liters" ? "L" : waterUnit === "oz" ? "oz" : "glasses";

  function setWater(next: number) {
    if (!user) return;
    const clamped = Math.max(0, Math.round(next * 100) / 100);
    setData((prev) => ({ ...prev, log: { ...(prev.log ?? { id: `${user.uid}_${date}`, userId: user.uid, date, water: 0, waterTarget, breakfast: false, lunch: false, dinner: false, calories: null, protein: null, carbs: null, fat: null, cost: null, notes: null, createdAt: 0 }), water: clamped } }));
    void upsertNutritionLog(user.uid, date, { water: clamped }).catch(() => void load(date, { quiet: true }));
  }
  function setTarget(next: number) {
    if (!user) return;
    setData((prev) => ({ ...prev, log: prev.log ? { ...prev.log, waterTarget: next } : prev.log }));
    void upsertNutritionLog(user.uid, date, { waterTarget: next }).catch(() => void load(date, { quiet: true }));
  }
  function commitProtein(n: number) {
    setProteinTarget(n);
    if (user) void upsertPrefs(user.uid, { proteinTarget: n });
  }

  function toggleCollapse(m: NutritionMeal) {
    setData((prev) => ({ ...prev, meals: prev.meals.map((x) => (x.id === m.id ? { ...x, collapsed: !x.collapsed } : x)) }));
    void updateNutritionMeal(m.id, { collapsed: !m.collapsed });
  }
  async function duplicate(m: NutritionMeal) {
    if (!user) return;
    await createNutritionMeal(user.uid, date, { name: `${m.name} (copy)`, icon: m.icon, color: m.color, time: m.time, notes: m.notes, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, cost: m.cost, items: m.items, sortOrder: meals.length });
    await load(date, { quiet: true, sync: true });
  }
  async function remove(m: NutritionMeal) {
    setData((prev) => ({ ...prev, meals: prev.meals.filter((x) => x.id !== m.id) }));
    await deleteNutritionMeal(m.id);
    await load(date, { quiet: true, sync: true });
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = meals.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    const byId = new Map(meals.map((m) => [m.id, m]));
    setData((prev) => ({ ...prev, meals: next.map((id) => byId.get(id)!).filter(Boolean) }));
    void reorderNutritionMeals(next);
    setDragId(null);
  }

  const isToday = date === today;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Utensils className="h-6 w-6 text-primary" /> Nutrition</h1>
          <p className="text-muted-foreground">Eat consistently — fewer decisions, healthier days.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" onClick={() => setDate(today)} className="min-w-[140px] text-center text-sm font-medium">{formatLongDate(date)}</button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next day" disabled={isToday} onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" onClick={() => router.push("/nutrition/foods")}><Library className="h-4 w-4" /> Food Library</Button>
          <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add meal</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={3} /><SkeletonCard lines={6} /></div>
      ) : (
        <>
          {/* Daily summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryTile icon={<Flame className="h-3.5 w-3.5" />} label="Calories" value={summary.calories > 0 ? String(summary.calories) : "—"} hint={summary.carbs > 0 || summary.fat > 0 ? `${summary.carbs}C · ${summary.fat}F` : "kcal"} />
            <SummaryTile icon={<Beef className="h-3.5 w-3.5" />} label="Protein" value={summary.protein > 0 ? `${summary.protein}g` : "—"} hint={`goal ${proteinTarget}g`} />
            <SummaryTile icon={<GlassWater className="h-3.5 w-3.5" />} label="Water" value={`${water}${waterUnit === "liters" ? "L" : ""}`} hint={`of ${waterTarget}`} />
            <SummaryTile icon={<Wallet className="h-3.5 w-3.5" />} label="Food cost" value={summary.cost > 0 && currency ? formatAmount(summary.cost, currency) : "—"} hint="today" />
            <div className="col-span-2 sm:col-span-1">
              <Card className="flex h-full items-center gap-3 p-3">
                <Ring value={summary.healthScore} color={hm.color} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><HeartPulse className="h-3 w-3" /> Health</p>
                  <p className="text-sm font-bold" style={{ color: hm.color }}>{hm.label}</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Water */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><GlassWater className="h-3.5 w-3.5" /> Water</span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Goal <NumberField value={waterTarget} onCommit={setTarget} min={1} max={30} decimals={waterUnit === "liters"} suffix={unitLabel} aria-label="Water goal" /></div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <Button variant="outline" size="icon" onClick={() => setWater(water - step)} disabled={water <= 0} aria-label="Less water"><Minus className="h-4 w-4" /></Button>
              <div className="flex-1">
                <p className="text-center text-2xl font-bold tabular-nums">{water}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {waterTarget} {unitLabel}</span></p>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (water / (waterTarget || 1)) * 100)}%` }} /></div>
              </div>
              <Button variant="outline" size="icon" onClick={() => setWater(water + step)} aria-label="More water"><Plus className="h-4 w-4" /></Button>
            </div>
          </Card>

          {/* Today's meals */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Today&apos;s meals {meals.length > 0 && `· ${meals.length}`}</h2>
              {meals.length > 0 && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add</Button>}
            </div>
            {meals.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <Utensils className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No meals yet for {isToday ? "today" : "this day"}</p>
                <p className="max-w-sm text-sm text-muted-foreground">Add any meal you like — breakfast, a snack, pre-workout, meal prep. Fully customizable.</p>
                <Button onClick={() => setDialog({ open: true, meal: null })}><Plus className="h-4 w-4" /> Add your first meal</Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {meals.map((m) => (
                  <MealCard
                    key={m.id}
                    meal={m}
                    currency={cur}
                    dragging={dragId === m.id}
                    onToggleCollapse={() => toggleCollapse(m)}
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

          {/* Protein goal (kept out of the way) */}
          <Card className="flex items-center justify-between p-3">
            <Label className="flex items-center gap-1.5 text-sm text-muted-foreground"><Beef className="h-3.5 w-3.5" /> Daily protein goal</Label>
            <NumberField value={proteinTarget} onCommit={commitProtein} min={0} max={400} suffix="g" aria-label="Protein goal" />
          </Card>
        </>
      )}

      {user && (
        <MealDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}
          userId={user.uid}
          date={date}
          meal={dialog.meal}
          foods={data.foods}
          currency={cur}
          onManageFoods={() => router.push("/nutrition/foods")}
          onSaved={() => load(date, { quiet: true, sync: true })}
        />
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}
