"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Copy, X, Minus, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeField } from "@/components/ui/time-field";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { createNutritionMeal, updateNutritionMeal, deleteNutritionMeal, type NutritionMealInput } from "@/lib/firebase/db";
import { MEAL_ICONS, MEAL_COLORS, MEAL_TEMPLATES } from "@/lib/nutrition";
import { foodToEntry, entryMacros, entryCost, mealTotals, genId } from "@/lib/food";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { NutritionMeal, MealFoodEntry, FoodItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  date: string;
  meal?: NutritionMeal | null;
  foods: FoodItem[];
  currency: Currency;
  onSaved: () => void;
  onManageFoods?: () => void;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s) * 100) / 100) || (Number(s) === 0 ? 0 : null));

export function MealDialog({ open, onOpenChange, userId, date, meal, foods, currency, onSaved, onManageFoods }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🍽️");
  const [color, setColor] = useState<string>(MEAL_COLORS[0]);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MealFoodEntry[]>([]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(meal?.name ?? "");
    setIcon(meal?.icon ?? "🍽️");
    setColor(meal?.color ?? MEAL_COLORS[0]);
    setTime(meal?.time ?? "");
    setNotes(meal?.notes ?? "");
    setItems(meal?.items ? meal.items.map((e) => ({ ...e })) : []);
    setCalories(meal?.calories != null ? String(meal.calories) : "");
    setProtein(meal?.protein != null ? String(meal.protein) : "");
    setCarbs(meal?.carbs != null ? String(meal.carbs) : "");
    setFat(meal?.fat != null ? String(meal.fat) : "");
    setCost(meal?.cost != null ? String(meal.cost) : "");
  }, [open, meal]);

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const totals = useMemo(() => mealTotals({ items, calories: null, protein: null, carbs: null, fat: null, cost: null }), [items]);

  function addFood(food: FoodItem) {
    const serving = food.servings[0] ?? { id: genId(), label: `100 ${food.unit}`, grams: 100 };
    setItems((prev) => [...prev, foodToEntry(food, serving, 1, prev.length)]);
  }
  function patchItem(id: string, patch: Partial<MealFoodEntry>) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function setQty(id: string, qty: number) {
    patchItem(id, { quantity: Math.max(0, Math.round(qty * 100) / 100) });
  }
  function changeServing(entry: MealFoodEntry, servingId: string) {
    const food = foodById.get(entry.foodId);
    const s = food?.servings.find((x) => x.id === servingId);
    if (s) patchItem(entry.id, { servingLabel: s.label, servingGrams: s.grams });
  }
  function duplicateItem(entry: MealFoodEntry) {
    setItems((prev) => {
      const i = prev.findIndex((e) => e.id === entry.id);
      const copy = { ...entry, id: genId() };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next.map((e, idx) => ({ ...e, sortOrder: idx }));
    });
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((e) => e.id !== id).map((e, idx) => ({ ...e, sortOrder: idx })));
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    setItems((prev) => {
      const ids = prev.map((e) => e.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((e, idx) => ({ ...e, sortOrder: idx }));
    });
    setDragId(null);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const hasItems = items.length > 0;
    const input: NutritionMealInput = {
      name: name.trim(), icon, color, time: time || null, notes: notes.trim() || null,
      items: items.map((e, idx) => ({ ...e, sortOrder: idx })),
      calories: hasItems ? null : numOrNull(calories),
      protein: hasItems ? null : numOrNull(protein),
      carbs: hasItems ? null : numOrNull(carbs),
      fat: hasItems ? null : numOrNull(fat),
      cost: hasItems ? null : numOrNull(cost),
    };
    try {
      if (meal) await updateNutritionMeal(meal.id, input);
      else await createNutritionMeal(userId, date, input);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!meal) return;
    setSaving(true);
    try {
      await deleteNutritionMeal(meal.id);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2"><span>{icon}</span> {meal ? "Edit meal" : "Add meal"}</DialogTitle>
          <DialogDescription>Build it from your Food Library — quantities and totals update live.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!meal && (
            <div className="flex flex-wrap gap-1.5">
              {MEAL_TEMPLATES.map((t) => (
                <button key={t.name} type="button" onClick={() => { setName(t.name); setIcon(t.icon); setColor(t.color); setTime(t.time); }} className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent">
                  <span>{t.icon}</span> {t.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[1fr_130px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Name</Label>
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Post Workout" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <TimeField value={time} onChange={setTime} ariaLabel="Meal time" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1">
                {MEAL_ICONS.slice(0, 12).map((ic) => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)} className={cn("flex h-7 w-7 items-center justify-center rounded-lg border text-base transition", icon === ic ? "border-primary bg-primary/10" : "hover:bg-accent")}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-1">
                {MEAL_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn("h-6 w-6 rounded-full border border-black/10 transition dark:border-white/20", color === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:scale-110")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Foods */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Foods</Label>
              {onManageFoods && <button type="button" onClick={onManageFoods} className="text-xs text-primary underline">Manage library</button>}
            </div>

            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map((e) => {
                  const food = foodById.get(e.foodId);
                  const m = entryMacros(e);
                  const currentServingId = food?.servings.find((s) => s.label === e.servingLabel && s.grams === e.servingGrams)?.id;
                  return (
                    <div
                      key={e.id}
                      draggable
                      onDragStart={() => setDragId(e.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(ev) => { if (dragId) ev.preventDefault(); }}
                      onDrop={(ev) => { ev.preventDefault(); dropOn(e.id); }}
                      className={cn("rounded-lg border bg-card p-2", dragId === e.id && "opacity-40")}
                    >
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                        <button type="button" onClick={() => duplicateItem(e)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Duplicate food"><Copy className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => removeItem(e.id)} className="p-1 text-muted-foreground hover:text-rose-500" aria-label="Remove food"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 pl-5">
                        <div className="flex items-center rounded-md border">
                          <button type="button" onClick={() => setQty(e.id, e.quantity - (e.quantity > 1 ? 1 : 0.5))} className="px-1.5 py-1 text-muted-foreground hover:text-foreground" aria-label="Less"><Minus className="h-3 w-3" /></button>
                          <input type="number" min={0} step="0.25" value={e.quantity} onChange={(ev) => setQty(e.id, Number(ev.target.value) || 0)} className="w-10 border-x bg-transparent py-1 text-center text-sm tabular-nums outline-none" aria-label="Quantity" />
                          <button type="button" onClick={() => setQty(e.id, e.quantity + 1)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground" aria-label="More"><Plus className="h-3 w-3" /></button>
                        </div>
                        {food && food.servings.length > 0 ? (
                          <Select value={currentServingId ?? "_"} onValueChange={(v) => changeServing(e, v)}>
                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {!currentServingId && <SelectItem value="_">{e.servingLabel || `${e.servingGrams} ${e.unit}`}</SelectItem>}
                              {food.servings.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="flex-1 truncate text-xs text-muted-foreground">{e.servingLabel || `${e.servingGrams} ${e.unit}`}</span>
                        )}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(m.calories)} kcal · {formatAmount(entryCost(e), currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <FoodPicker foods={foods} onPick={addFood} onCreateNew={onManageFoods} />
          </div>

          {/* Live totals (from foods) OR manual entry */}
          {items.length > 0 ? (
            <div className="grid grid-cols-5 gap-1.5 rounded-xl border bg-muted/30 p-2 text-center">
              <Total label="Cal" value={String(totals.calories)} />
              <Total label="Protein" value={`${totals.protein}g`} />
              <Total label="Carbs" value={`${totals.carbs}g`} />
              <Total label="Fat" value={`${totals.fat}g`} />
              <Total label="Cost" value={formatAmount(totals.cost, currency)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Or enter totals manually</Label>
              <div className="grid grid-cols-5 gap-1.5">
                <Manual label="Cal" value={calories} onChange={setCalories} />
                <Manual label="Protein" value={protein} onChange={setProtein} />
                <Manual label="Carbs" value={carbs} onChange={setCarbs} />
                <Manual label="Fat" value={fat} onChange={setFat} />
                <Manual label="Cost" value={cost} onChange={setCost} step="0.01" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How you felt, tweaks for next time…" rows={2} />
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          {meal ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={saving}>Delete</Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving || !name.trim()}>{saving ? "Saving…" : meal ? "Save" : "Add meal"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Manual({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-0.5">
      <Input type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" className="h-8 px-2 text-center text-sm" />
      <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
