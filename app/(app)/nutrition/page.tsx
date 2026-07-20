"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  GlassWater,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionLog,
  getNutritionLogs,
  upsertNutritionLog,
  getPrefs,
  upsertPrefs,
  type NutritionLogInput,
} from "@/lib/firebase/db";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserPrefs } from "@/lib/types";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import {
  DEFAULT_WATER_TARGET,
  hydrationRating,
  mealsEaten,
} from "@/lib/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NutritionLog } from "@/lib/types";

interface DayState {
  water: number;
  waterTarget: number;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  calories: string;
  notes: string;
}

const MEALS: { key: "breakfast" | "lunch" | "dinner"; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

export default function NutritionPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [date, setDate] = useState(today);
  const [state, setState] = useState<DayState>({
    water: 0,
    waterTarget: DEFAULT_WATER_TARGET,
    breakfast: false,
    lunch: false,
    dinner: false,
    calories: "",
    notes: "",
  });
  const [targetInput, setTargetInput] = useState(String(DEFAULT_WATER_TARGET));
  const [waterUnit, setWaterUnit] = useState<UserPrefs["waterUnit"]>("glasses");
  const [history, setHistory] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Synchronous mirror of water for correct rapid +/- taps.
  const waterRef = useRef(0);
  // Request token so a slow response for an old day can't clobber a newer one.
  const reqRef = useRef(0);
  // Last-persisted text values, to skip no-op writes on blur.
  const savedRef = useRef({ calories: "", notes: "" });

  const loadDay = useCallback(
    async (d: string) => {
      if (!user) return;
      const req = ++reqRef.current;
      setLoading(true);
      try {
        const log = await getNutritionLog(user.uid, d);
        if (reqRef.current !== req) return; // a newer day was selected
        const cal = log?.calories != null ? String(log.calories) : "";
        const notes = log?.notes ?? "";
        const wt = log?.waterTarget ?? DEFAULT_WATER_TARGET;
        setState({
          water: log?.water ?? 0,
          waterTarget: wt,
          breakfast: log?.breakfast ?? false,
          lunch: log?.lunch ?? false,
          dinner: log?.dinner ?? false,
          calories: cal,
          notes,
        });
        setTargetInput(String(wt));
        waterRef.current = log?.water ?? 0;
        savedRef.current = { calories: cal, notes };
      } finally {
        if (reqRef.current === req) setLoading(false);
      }
    },
    [user]
  );

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const [logs, prefs] = await Promise.all([
      getNutritionLogs(user.uid),
      getPrefs(user.uid),
    ]);
    setHistory(logs);
    setWaterUnit(prefs.waterUnit);
  }, [user]);

  async function changeWaterUnit(unit: UserPrefs["waterUnit"]) {
    if (!user) return;
    setWaterUnit(unit);
    await upsertPrefs(user.uid, { waterUnit: unit });
  }

  useEffect(() => {
    loadDay(date);
  }, [loadDay, date]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Optimistically fold a patch into the history list for the current day
  // (avoids re-reading the whole collection after every tap).
  const mergeHistory = useCallback(
    (patch: Partial<NutritionLogInput>) => {
      if (!user) return;
      setHistory((prev) => {
        const idx = prev.findIndex((l) => l.date === date);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...patch };
          return copy;
        }
        const base: NutritionLog = {
          id: `${user.uid}_${date}`,
          userId: user.uid,
          date,
          water: 0,
          waterTarget: DEFAULT_WATER_TARGET,
          breakfast: false,
          lunch: false,
          dinner: false,
          calories: null,
          notes: null,
          createdAt: Date.now(),
          ...patch,
        };
        return [base, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1));
      });
    },
    [user, date]
  );

  const persist = useCallback(
    async (patch: Partial<NutritionLogInput>) => {
      if (!user) return;
      mergeHistory(patch);
      await upsertNutritionLog(user.uid, date, patch);
    },
    [user, date, mergeHistory]
  );

  const waterStep = waterUnit === "liters" ? 0.25 : 1;

  function setWaterAbsolute(next: number) {
    const water = Math.max(0, Math.round(next * 100) / 100);
    waterRef.current = water;
    setState((s) => ({ ...s, water }));
    void persist({ water });
  }

  function incWater(delta: number) {
    setWaterAbsolute(waterRef.current + delta);
  }

  function commitTarget() {
    const n = Number(targetInput.replace(",", "."));
    if (targetInput.trim() === "" || Number.isNaN(n)) {
      setTargetInput(String(state.waterTarget)); // revert invalid input
      return;
    }
    // Liters can be fractional; glass/oz targets stay whole numbers.
    const clamped = Math.max(waterStep, Math.min(40, n));
    const waterTarget =
      waterUnit === "liters" ? Math.round(clamped * 100) / 100 : Math.round(clamped);
    setTargetInput(String(waterTarget));
    if (waterTarget !== state.waterTarget) {
      setState((s) => ({ ...s, waterTarget }));
      void persist({ waterTarget });
    }
  }

  function toggleMeal(key: "breakfast" | "lunch" | "dinner", value: boolean) {
    setState((s) => ({ ...s, [key]: value }));
    void persist({ [key]: value });
  }

  function saveCalories() {
    if (state.calories === savedRef.current.calories) return;
    savedRef.current = { ...savedRef.current, calories: state.calories };
    const n = state.calories.trim() === "" ? null : Number(state.calories);
    void persist({
      calories:
        n != null && !Number.isNaN(n) ? Math.max(0, Math.round(n)) : null,
    });
  }

  function saveNotes() {
    if (state.notes === savedRef.current.notes) return;
    savedRef.current = { ...savedRef.current, notes: state.notes };
    void persist({ notes: state.notes.trim() || null });
  }

  const isToday = date === today;
  const hr = hydrationRating(state.water, state.waterTarget);

  const weekAvgWater = useMemo(() => {
    const cutoff = addDays(today, -6);
    const recent = history.filter((l) => l.date >= cutoff);
    if (recent.length === 0) return 0;
    return recent.reduce((s, l) => s + l.water, 0) / recent.length;
  }, [history, today]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Nutrition &amp; Water</h1>
        <p className="text-muted-foreground">
          {weekAvgWater > 0
            ? `Averaging ${weekAvgWater.toFixed(1)} glasses of water a day this week.`
            : "Stay hydrated and log your meals — both drive daily energy."}
        </p>
      </div>

      {/* Day nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDate((d) => addDays(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{formatLongDate(date)}</p>
          {isToday ? (
            <Badge variant="default" className="mt-1">
              Today
            </Badge>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setDate(today)}
            >
              Jump to today
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => setDate((d) => addDays(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Water */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GlassWater className="h-5 w-5 text-primary" /> Water
              </CardTitle>
              <Badge variant={hr.variant}>{hr.label}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {/* Directly typeable value — the stepper is a shortcut. */}
                  <NumberField
                    value={state.water}
                    onCommit={setWaterAbsolute}
                    min={0}
                    decimals={waterUnit === "liters"}
                    aria-label="Water logged (type exact value)"
                    inputClassName="w-16 text-2xl font-semibold h-10"
                  />
                  <span className="text-lg text-muted-foreground">
                    / {state.waterTarget} {waterUnit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remove"
                    onClick={() => incWater(-waterStep)}
                    disabled={state.water <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    aria-label="Add"
                    onClick={() => incWater(waterStep)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Glass row (whole-unit modes only) */}
              {waterUnit !== "liters" && state.waterTarget <= 20 && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.round(state.waterTarget) }).map(
                    (_, i) => (
                      <button
                        key={i}
                        aria-label={`Set water to ${i + 1}`}
                        onClick={() => setWaterAbsolute(i + 1)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                          i < state.water
                            ? "border-primary bg-primary/15 text-primary"
                            : "text-muted-foreground/40 hover:border-primary/40"
                        )}
                      >
                        <GlassWater className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="target" className="text-sm text-muted-foreground">
                    Daily goal
                  </Label>
                  <Input
                    id="target"
                    type="text"
                    inputMode="decimal"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onBlur={commitTarget}
                    className="h-8 w-20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Unit</Label>
                  <Select
                    value={waterUnit}
                    onValueChange={(v) =>
                      changeWaterUnit(v as UserPrefs["waterUnit"])
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glasses">glasses</SelectItem>
                      <SelectItem value="liters">liters</SelectItem>
                      <SelectItem value="oz">oz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Utensils className="h-5 w-5 text-primary" /> Meals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                {MEALS.map((m) => (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={state[m.key]}
                      onCheckedChange={(c) => toggleMeal(m.key, Boolean(c))}
                    />
                    <span className="text-sm">{m.label} eaten</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="calories">Calories (optional)</Label>
                <Input
                  id="calories"
                  type="number"
                  min={0}
                  value={state.calories}
                  onChange={(e) =>
                    setState((s) => ({ ...s, calories: e.target.value }))
                  }
                  onBlur={saveCalories}
                  placeholder="e.g. 2200"
                  className="max-w-[180px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={state.notes}
                  onChange={(e) =>
                    setState((s) => ({ ...s, notes: e.target.value }))
                  }
                  onBlur={saveNotes}
                  placeholder="What you ate, how you felt…"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Recent days
        </h2>
        {history.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <GlassWater className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {history.slice(0, 30).map((log) => {
                const rating = hydrationRating(log.water, log.waterTarget);
                return (
                  <button
                    key={log.id}
                    onClick={() => setDate(log.date)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatLongDate(log.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.water}/{log.waterTarget} glasses ·{" "}
                        {mealsEaten(log)}/3 meals
                        {log.calories != null && <> · {log.calories} cal</>}
                      </p>
                    </div>
                    <Badge variant={rating.variant}>{rating.label}</Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
