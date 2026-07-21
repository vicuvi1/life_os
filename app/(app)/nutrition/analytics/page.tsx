"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Beef, GlassWater, Wallet, Utensils, HeartPulse, TrendingUp, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getNutritionAll, getBudget, getPrefs, upsertPrefs, type NutritionAll } from "@/lib/firebase/db";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { toFoodMap, mealTotals, entryMacros } from "@/lib/food";
import { healthScore, healthMeta, DEFAULT_WATER_TARGET, DEFAULT_PROTEIN_TARGET } from "@/lib/nutrition";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { startOfWeekKey } from "@/lib/dates";
import { FOOD_CATEGORIES } from "@/lib/food";
import { Card } from "@/components/ui/card";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { cn } from "@/lib/utils";

export default function NutritionAnalyticsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [proteinTarget, setProteinTarget] = useState(DEFAULT_PROTEIN_TARGET);
  const [weeklyBudget, setWeeklyBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [fMeal, setFMeal] = useState<string | null>(null);
  const [fFood, setFFood] = useState<string | null>(null);
  const [fCat, setFCat] = useState<string | null>(null);
  const [fTag, setFTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [data, budget, prefs] = await Promise.all([getNutritionAll(user.uid), getBudget(user.uid), getPrefs(user.uid)]);
      setAll(data);
      setCurrency(resolveCurrency(budget));
      setProteinTarget(prefs.proteinTarget ?? DEFAULT_PROTEIN_TARGET);
      setWeeklyBudget(prefs.foodBudgetWeekly ?? null);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const foodMap = useMemo(() => toFoodMap(all?.foods ?? []), [all]);
  const cur = currency ?? resolveCurrency(null);
  const logByDate = useMemo(() => new Map((all?.logs ?? []).map((l) => [l.date, l])), [all]);

  const dayKeys = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, -(range - 1) + i)), [range, today]);
  const rangeStart = dayKeys[0];

  const mealNames = useMemo(() => [...new Set((all?.meals ?? []).map((m) => m.name))].sort(), [all]);
  const activeFoods = useMemo(() => (all?.foods ?? []).filter((f) => !f.archived), [all]);
  const tags = useMemo(() => [...new Set(activeFoods.flatMap((f) => f.tags))].sort(), [activeFoods]);
  const filtersActive = !!(fMeal || fFood || fCat || fTag);

  /** Meals within the window that pass the active filters. */
  const windowMeals = useMemo(() => {
    return (all?.meals ?? []).filter((m) => {
      if (m.date < rangeStart || m.date > today) return false;
      if (fMeal && m.name !== fMeal) return false;
      if (fFood && !m.items.some((e) => e.foodId === fFood)) return false;
      if (fCat && !m.items.some((e) => foodMap.get(e.foodId)?.category === fCat)) return false;
      if (fTag && !m.items.some((e) => foodMap.get(e.foodId)?.tags.includes(fTag))) return false;
      return true;
    });
  }, [all, rangeStart, today, fMeal, fFood, fCat, fTag, foodMap]);

  const mealsByDate = useMemo(() => {
    const m = new Map<string, typeof windowMeals>();
    for (const meal of windowMeals) (m.get(meal.date) ?? m.set(meal.date, []).get(meal.date)!).push(meal);
    return m;
  }, [windowMeals]);

  const perDay = useMemo(() => dayKeys.map((k) => {
    const meals = mealsByDate.get(k) ?? [];
    const t = meals.reduce((a, meal) => {
      const mt = mealTotals(meal, foodMap);
      a.calories += mt.calories; a.protein += mt.protein; a.cost += mt.cost; return a;
    }, { calories: 0, protein: 0, cost: 0 });
    return { key: k, calories: Math.round(t.calories), protein: Math.round(t.protein), cost: Math.round(t.cost * 100) / 100, meals: meals.length, water: logByDate.get(k)?.water ?? 0 };
  }), [dayKeys, mealsByDate, foodMap, logByDate]);

  // Today (always unfiltered)
  const todayMeals = useMemo(() => (all?.meals ?? []).filter((m) => m.date === today), [all, today]);
  const todayTotals = useMemo(() => todayMeals.reduce((a, m) => { const t = mealTotals(m, foodMap); a.calories += t.calories; a.protein += t.protein; a.cost += t.cost; return a; }, { calories: 0, protein: 0, cost: 0 }), [todayMeals, foodMap]);
  const todayLog = logByDate.get(today);
  const waterTarget = todayLog?.waterTarget ?? DEFAULT_WATER_TARGET;
  const hs = healthScore({ water: todayLog?.water ?? 0, waterTarget, mealCount: todayMeals.length, protein: todayTotals.protein, proteinTarget });
  const hm = healthMeta(hs);

  // Averages over active days in range
  const proteinDays = perDay.filter((d) => d.meals > 0);
  const avgProtein = proteinDays.length ? Math.round(proteinDays.reduce((s, d) => s + d.protein, 0) / proteinDays.length) : 0;
  const waterDays = perDay.filter((d) => d.water > 0);
  const avgWater = waterDays.length ? Math.round((waterDays.reduce((s, d) => s + d.water, 0) / waterDays.length) * 10) / 10 : 0;

  // Budget
  const weekStart = startOfWeekKey(today);
  const weekSpend = useMemo(() => (all?.meals ?? []).filter((m) => m.date >= weekStart && m.date <= today).reduce((s, m) => s + mealTotals(m, foodMap).cost, 0), [all, weekStart, today, foodMap]);
  const thisMonth = today.slice(0, 7);
  const monthSpend = useMemo(() => (all?.meals ?? []).filter((m) => m.date.slice(0, 7) === thisMonth).reduce((s, m) => s + mealTotals(m, foodMap).cost, 0), [all, thisMonth, foodMap]);

  // Most eaten foods + favorite meals (windowed + filtered)
  const mostEaten = useMemo(() => {
    const acc = new Map<string, { name: string; uses: number; calories: number }>();
    for (const meal of windowMeals) for (const e of meal.items) {
      const food = foodMap.get(e.foodId);
      const cur = acc.get(e.foodId) ?? { name: food?.name ?? e.name, uses: 0, calories: 0 };
      cur.uses += 1; cur.calories += entryMacros(e, food).calories;
      acc.set(e.foodId, cur);
    }
    return [...acc.values()].sort((a, b) => b.uses - a.uses).slice(0, 6);
  }, [windowMeals, foodMap]);

  const favoriteMeals = useMemo(() => {
    const acc = new Map<string, number>();
    for (const m of windowMeals) acc.set(m.name, (acc.get(m.name) ?? 0) + 1);
    return [...acc.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [windowMeals]);

  function commitBudget(n: number) {
    setWeeklyBudget(n);
    if (user) void upsertPrefs(user.uid, { foodBudgetWeekly: n });
  }
  function resetFilters() { setFMeal(null); setFFood(null); setFCat(null); setFTag(null); }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <NutritionNav />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><TrendingUp className="h-6 w-6 text-primary" /> Analytics</h1>
        <p className="text-muted-foreground">A clear read on how you&apos;re eating, spending, and staying on track.</p>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={5} /></div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(range)} onValueChange={(v) => setRange(Number(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
            </Select>
            <FilterSelect value={fMeal} onChange={setFMeal} placeholder="Any meal" options={mealNames} />
            <FilterSelect value={fCat} onChange={setFCat} placeholder="Any category" options={FOOD_CATEGORIES} />
            {tags.length > 0 && <FilterSelect value={fTag} onChange={setFTag} placeholder="Any tag" options={tags} />}
            <FilterSelect value={fFood} onChange={setFFood} placeholder="Any food" options={activeFoods.map((f) => f.id)} labels={new Map(activeFoods.map((f) => [f.id, f.name]))} />
            {filtersActive && <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetFilters}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>}
          </div>

          {/* Today */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Today</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Calories" value={todayTotals.calories > 0 ? String(todayTotals.calories) : "—"} />
              <Stat icon={<Beef className="h-3.5 w-3.5" />} label="Protein" value={todayTotals.protein > 0 ? `${Math.round(todayTotals.protein)}g` : "—"} />
              <Stat icon={<GlassWater className="h-3.5 w-3.5" />} label="Water" value={`${todayLog?.water ?? 0}`} />
              <Stat icon={<Wallet className="h-3.5 w-3.5" />} label="Food cost" value={todayTotals.cost > 0 ? formatAmount(todayTotals.cost, cur) : "—"} />
              <Stat icon={<Utensils className="h-3.5 w-3.5" />} label="Meals" value={String(todayMeals.length)} />
              <Stat icon={<HeartPulse className="h-3.5 w-3.5" />} label="Health" value={String(hs)} valueClass="" style={{ color: hm.color }} />
            </div>
          </div>

          {/* Budget + averages */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Weekly food budget</span>
                <NumberField value={weeklyBudget ?? 0} onCommit={commitBudget} min={0} aria-label="Weekly food budget" />
              </div>
              {weeklyBudget && weeklyBudget > 0 ? (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold tabular-nums">{formatAmount(Math.round(weekSpend * 100) / 100, cur)}</span>
                    <span className="text-muted-foreground">of {formatAmount(weeklyBudget, cur)} this week</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", weekSpend > weeklyBudget ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (weekSpend / weeklyBudget) * 100)}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Set a weekly budget to track spending against it. Spent this week: <span className="font-medium text-foreground">{formatAmount(Math.round(weekSpend * 100) / 100, cur)}</span></p>
              )}
              <p className="pt-1 text-xs text-muted-foreground">This month: <span className="font-medium text-foreground">{formatAmount(Math.round(monthSpend * 100) / 100, cur)}</span></p>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={<Beef className="h-3.5 w-3.5" />} label={`Avg protein / day`} value={avgProtein > 0 ? `${avgProtein}g` : "—"} hint={`over ${proteinDays.length}d logged`} big />
              <Stat icon={<GlassWater className="h-3.5 w-3.5" />} label="Avg water / day" value={avgWater > 0 ? String(avgWater) : "—"} hint={`over ${waterDays.length}d logged`} big />
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ChartCard title="Daily calories" range={`${rangeStart} → today`}><MiniBars data={perDay.map((d) => ({ key: d.key, value: d.calories }))} barClass="bg-primary" /></ChartCard>
            <ChartCard title="Protein trend" range="grams / day"><MiniBars data={perDay.map((d) => ({ key: d.key, value: d.protein }))} barClass="bg-emerald-500" /></ChartCard>
            <ChartCard title="Water trend" range="per day"><MiniBars data={perDay.map((d) => ({ key: d.key, value: d.water }))} barClass="bg-sky-500" /></ChartCard>
            <ChartCard title="Food spending" range={`per day · ${cur.code}`}><MiniBars data={perDay.map((d) => ({ key: d.key, value: d.cost }))} barClass="bg-amber-500" /></ChartCard>
            <ChartCard title="Meal frequency" range="meals / day"><MiniBars data={perDay.map((d) => ({ key: d.key, value: d.meals }))} barClass="bg-violet-500" /></ChartCard>
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 lg:grid-cols-2">
              <RankCard title="Most eaten foods" empty="No foods logged in range" rows={mostEaten.map((f) => ({ label: f.name, value: `${f.uses}× · ${Math.round(f.calories)} kcal` }))} />
              <RankCard title="Favorite meals" empty="No meals logged in range" rows={favoriteMeals.map((m) => ({ label: m.name, value: `${m.count}×` }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options, labels }: { value: string | null; onChange: (v: string | null) => void; placeholder: string; options: string[]; labels?: Map<string, string> }) {
  if (options.length === 0) return null;
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{labels?.get(o) ?? o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Stat({ icon, label, value, hint, big, valueClass, style }: { icon: React.ReactNode; label: string; value: string; hint?: string; big?: boolean; valueClass?: string; style?: React.CSSProperties }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className={cn("mt-0.5 font-bold tabular-nums", big ? "text-2xl" : "text-xl", valueClass)} style={style}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function ChartCard({ title, range, children }: { title: string; range: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{range}</p>
      </div>
      {children}
    </Card>
  );
}

function MiniBars({ data, barClass }: { data: { key: string; value: number }[]; barClass: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasData = data.some((d) => d.value > 0);
  return (
    <div>
      <div className="flex h-24 items-end gap-px">
        {data.map((d) => (
          <div key={d.key} className="group relative flex flex-1 flex-col justify-end" title={`${d.key}: ${d.value}`}>
            <div className={cn("rounded-t-sm transition-all", barClass)} style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      {!hasData && <p className="pt-2 text-center text-xs text-muted-foreground">No data yet</p>}
    </div>
  );
}

function RankCard({ title, rows, empty }: { title: string; rows: { label: string; value: string }[]; empty: string }) {
  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.label + i} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
