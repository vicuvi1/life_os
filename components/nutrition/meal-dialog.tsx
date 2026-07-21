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
import { createNutritionMeal, updateNutritionMeal, deleteNutritionMeal, type NutritionMealInput } from "@/lib/firebase/db";
import { MEAL_ICONS, MEAL_COLORS, MEAL_TEMPLATES } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import type { NutritionMeal } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  date: string;
  meal?: NutritionMeal | null;
  currencySymbol?: string;
  onSaved: () => void;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s) * 100) / 100));

export function MealDialog({ open, onOpenChange, userId, date, meal, currencySymbol, onSaved }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🍽️");
  const [color, setColor] = useState<string>(MEAL_COLORS[0]);
  const [time, setTime] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(meal?.name ?? "");
    setIcon(meal?.icon ?? "🍽️");
    setColor(meal?.color ?? MEAL_COLORS[0]);
    setTime(meal?.time ?? "");
    setCalories(meal?.calories != null ? String(meal.calories) : "");
    setProtein(meal?.protein != null ? String(meal.protein) : "");
    setCost(meal?.cost != null ? String(meal.cost) : "");
    setNotes(meal?.notes ?? "");
  }, [open, meal]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const input: NutritionMealInput = {
      name: name.trim(), icon, color, time: time || null, notes: notes.trim() || null,
      calories: numOrNull(calories), protein: numOrNull(protein), cost: numOrNull(cost),
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
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span>{icon}</span> {meal ? "Edit meal" : "Add meal"}</DialogTitle>
          <DialogDescription>Name it whatever you like — it&apos;s fully customizable.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!meal && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Quick start</p>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TEMPLATES.map((t) => (
                  <button key={t.name} type="button" onClick={() => { setName(t.name); setIcon(t.icon); setColor(t.color); setTime(t.time); }} className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent">
                    <span>{t.icon}</span> {t.name}
                  </button>
                ))}
              </div>
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

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1">
              {MEAL_ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition", icon === ic ? "border-primary bg-primary/10" : "hover:bg-accent")}>{ic}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn("h-6 w-6 rounded-full border border-black/10 transition dark:border-white/20", color === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:scale-110")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label htmlFor="m-cal" className="text-xs">Calories</Label><Input id="m-cal" type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="—" /></div>
            <div className="space-y-1"><Label htmlFor="m-pro" className="text-xs">Protein (g)</Label><Input id="m-pro" type="number" min={0} value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="—" /></div>
            <div className="space-y-1"><Label htmlFor="m-cost" className="text-xs">Cost{currencySymbol ? ` (${currencySymbol})` : ""}</Label><Input id="m-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="—" /></div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you ate, how you felt…" rows={2} />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
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
