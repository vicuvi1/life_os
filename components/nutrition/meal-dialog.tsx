"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/ui/time-field";
import { FoodEntryBuilder } from "@/components/nutrition/food-entry-builder";
import { createNutritionMeal, updateNutritionMeal, deleteNutritionMeal, type NutritionMealInput } from "@/lib/firebase/db";
import { MEAL_ICONS, MEAL_COLORS, MEAL_TEMPLATES } from "@/lib/nutrition";
import { type Currency } from "@/lib/currency";
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Foods</Label>
              {onManageFoods && <button type="button" onClick={onManageFoods} className="text-xs text-primary underline">Manage library</button>}
            </div>
            <FoodEntryBuilder items={items} onChange={setItems} foods={foods} currency={currency} onManageFoods={onManageFoods} />
          </div>

          {items.length === 0 && (
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

function Manual({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-0.5">
      <Input type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" className="h-8 px-2 text-center text-sm" />
      <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
