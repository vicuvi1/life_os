"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMeal, updateMeal, type MealInput } from "@/lib/firebase/db";
import { MEAL_SLOTS, MEAL_SLOT_LABEL, parseIngredients } from "@/lib/meals";
import type { Meal, MealSlot } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  meal?: Meal | null;
  defaultSlot?: MealSlot;
  onSaved: () => void;
}

export function MealFormDialog({
  open,
  onOpenChange,
  userId,
  meal,
  defaultSlot = "dinner",
  onSaved,
}: Props) {
  const isEdit = Boolean(meal);
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [ingredients, setIngredients] = useState("");
  const [estCost, setEstCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(meal?.name ?? "");
    setSlot(meal?.slot ?? defaultSlot);
    setIngredients(meal ? meal.ingredients.join(", ") : "");
    setEstCost(meal?.estCost != null ? String(meal.estCost) : "");
    setError(null);
  }, [open, meal, defaultSlot]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the meal a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const cost = estCost.trim() === "" ? null : Number(estCost);
    const payload: MealInput = {
      name: name.trim(),
      slot,
      ingredients: parseIngredients(ingredients),
      estCost:
        cost != null && !Number.isNaN(cost) ? Math.max(0, cost) : null,
    };
    try {
      if (isEdit && meal) {
        await updateMeal(meal.id, payload);
      } else {
        await createMeal(userId, payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit meal" : "New meal"}</DialogTitle>
          <DialogDescription>
            Add a meal you can drop into any day this week.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken + rice + veggies"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slot</Label>
              <Select value={slot} onValueChange={(v) => setSlot(v as MealSlot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_SLOTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {MEAL_SLOT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-cost">Est. cost (optional)</Label>
              <Input
                id="m-cost"
                type="number"
                min={0}
                step="0.01"
                value={estCost}
                onChange={(e) => setEstCost(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-ing">Ingredients</Label>
            <Textarea
              id="m-ing"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Comma or line separated, e.g. chicken breast, rice, broccoli"
              className="min-h-[90px]"
            />
            <p className="text-xs text-muted-foreground">
              These roll up into your weekly shopping list automatically.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create meal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
