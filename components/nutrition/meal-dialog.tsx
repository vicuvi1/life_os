"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, PencilLine } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/ui/time-field";
import { FoodEntryBuilder } from "@/components/nutrition/food-entry-builder";
import { createNutritionMeal, updateNutritionMeal, deleteNutritionMeal, type NutritionMealInput } from "@/lib/firebase/db";
import { MEAL_ICONS, mealDefaultsByTime } from "@/lib/nutrition";
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
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MealFoodEntry[]>([]);
  const [manual, setManual] = useState({ calories: "", protein: "", carbs: "", fat: "", cost: "" });
  const [showManual, setShowManual] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = mealDefaultsByTime();
    setName(meal?.name ?? d.name);
    setIcon(meal?.icon ?? d.icon);
    setTime(meal?.time ?? "");
    setNotes(meal?.notes ?? "");
    setItems(meal?.items ? meal.items.map((e) => ({ ...e })) : []);
    setManual({
      calories: meal?.calories != null ? String(meal.calories) : "",
      protein: meal?.protein != null ? String(meal.protein) : "",
      carbs: meal?.carbs != null ? String(meal.carbs) : "",
      fat: meal?.fat != null ? String(meal.fat) : "",
      cost: meal?.cost != null ? String(meal.cost) : "",
    });
    const hasManual = !!meal && !meal.items.length && (meal.calories != null || meal.protein != null || meal.cost != null);
    setShowManual(hasManual);
    setShowDetails(!!meal && (!!meal.notes || !!meal.time));
  }, [open, meal]);

  async function save() {
    setSaving(true);
    const hasItems = items.length > 0;
    const useManual = !hasItems && showManual;
    const input: NutritionMealInput = {
      name: name.trim() || mealDefaultsByTime().name, icon, color: null, time: time || null, notes: notes.trim() || null,
      items: items.map((e, idx) => ({ ...e, sortOrder: idx })),
      calories: useManual ? numOrNull(manual.calories) : null,
      protein: useManual ? numOrNull(manual.protein) : null,
      carbs: useManual ? numOrNull(manual.carbs) : null,
      fat: useManual ? numOrNull(manual.fat) : null,
      cost: useManual ? numOrNull(manual.cost) : null,
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
    try { await deleteNutritionMeal(meal.id); onOpenChange(false); onSaved(); }
    finally { setSaving(false); }
  }

  const canSave = items.length > 0 || (showManual && Object.values(manual).some((v) => v.trim() !== "")) || !!meal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{meal ? "Edit meal" : "What are you eating?"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Food is the hero */}
          <FoodEntryBuilder items={items} onChange={setItems} foods={foods} currency={currency} onManageFoods={onManageFoods} />

          {/* Manual entry — only when nothing selected, and only on request */}
          {items.length === 0 && (
            showManual ? (
              <div className="space-y-1.5 rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Manual entry</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  <Manual label="Cal" value={manual.calories} onChange={(v) => setManual((m) => ({ ...m, calories: v }))} />
                  <Manual label="Protein" value={manual.protein} onChange={(v) => setManual((m) => ({ ...m, protein: v }))} />
                  <Manual label="Carbs" value={manual.carbs} onChange={(v) => setManual((m) => ({ ...m, carbs: v }))} />
                  <Manual label="Fat" value={manual.fat} onChange={(v) => setManual((m) => ({ ...m, fat: v }))} />
                  <Manual label="Cost" value={manual.cost} onChange={(v) => setManual((m) => ({ ...m, cost: v }))} step="0.01" />
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowManual(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground underline">
                <PencilLine className="h-3.5 w-3.5" /> Can&apos;t find a food? Enter it manually
              </button>
            )
          )}

          {/* Optional meal details */}
          <div className="rounded-lg border">
            <button type="button" onClick={() => setShowDetails((s) => !s)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="text-base">{icon}</span>
                <span className="font-medium text-foreground">{name || "Meal"}</span>
                {time && <span className="text-xs">· {time}</span>}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">Details {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
            </button>
            {showDetails && (
              <div className="space-y-3 border-t px-3 py-3">
                <div className="grid grid-cols-[1fr_130px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <TimeField value={time} onChange={setTime} ariaLabel="Meal time" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-1">
                    {MEAL_ICONS.slice(0, 12).map((ic) => (
                      <button key={ic} type="button" onClick={() => setIcon(ic)} className={cn("flex h-7 w-7 items-center justify-center rounded-lg border text-base transition", icon === ic ? "border-primary bg-primary/10" : "hover:bg-accent")}>{ic}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-notes">Notes</Label>
                  <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How you felt, tweaks for next time…" rows={2} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          {meal ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={saving}>Delete</Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving || !canSave}>{saving ? "Saving…" : meal ? "Save" : "Log meal"}</Button>
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
