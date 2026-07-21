"use client";

import { useMemo, useState } from "react";
import { GripVertical, Copy, X, Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { foodToEntry, entryMacros, entryCost, entriesTotals, genId, type FoodMap } from "@/lib/food";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { MealFoodEntry, FoodItem } from "@/lib/types";

interface Props {
  items: MealFoodEntry[];
  onChange: (items: MealFoodEntry[]) => void;
  foods: FoodItem[];
  currency: Currency;
  onManageFoods?: () => void;
}

/** The food list + live totals shared by the Meal Builder and Recipe editor.
 * Entries are pure references; macros/cost resolve live from the library. */
export function FoodEntryBuilder({ items, onChange, foods, currency, onManageFoods }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const foodById: FoodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const totals = useMemo(() => entriesTotals(items, foodById), [items, foodById]);

  function addFood(food: FoodItem) {
    const serving = food.servings[0] ?? { id: genId(), label: `100 ${food.unit}`, grams: 100 };
    onChange([...items, foodToEntry(food, serving, 1, items.length)]);
  }
  function patch(id: string, p: Partial<MealFoodEntry>) {
    onChange(items.map((e) => (e.id === id ? { ...e, ...p } : e)));
  }
  function setQty(id: string, qty: number) {
    patch(id, { quantity: Math.max(0, Math.round(qty * 100) / 100) });
  }
  function changeServing(entry: MealFoodEntry, servingId: string) {
    const s = foodById.get(entry.foodId)?.servings.find((x) => x.id === servingId);
    if (s) patch(entry.id, { servingLabel: s.label, servingGrams: s.grams });
  }
  function duplicate(entry: MealFoodEntry) {
    const i = items.findIndex((e) => e.id === entry.id);
    const next = [...items];
    next.splice(i + 1, 0, { ...entry, id: genId() });
    onChange(next.map((e, idx) => ({ ...e, sortOrder: idx })));
  }
  function remove(id: string) {
    onChange(items.filter((e) => e.id !== id).map((e, idx) => ({ ...e, sortOrder: idx })));
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = items.map((e) => e.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((e, idx) => ({ ...e, sortOrder: idx })));
    setDragId(null);
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((e) => {
            const food = foodById.get(e.foodId);
            const m = entryMacros(e, food);
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
                  <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", !food && "text-muted-foreground line-through")}>{food?.name ?? e.name}</span>
                  <button type="button" onClick={() => duplicate(e)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Duplicate food"><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => remove(e.id)} className="p-1 text-muted-foreground hover:text-rose-500" aria-label="Remove food"><X className="h-4 w-4" /></button>
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
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(m.calories)} kcal · {formatAmount(entryCost(e, food), currency)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FoodPicker foods={foods} onPick={addFood} onCreateNew={onManageFoods} />

      {items.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5 rounded-xl border bg-muted/30 p-2 text-center">
          <Total label="Cal" value={String(totals.calories)} />
          <Total label="Protein" value={`${totals.protein}g`} />
          <Total label="Carbs" value={`${totals.carbs}g`} />
          <Total label="Fat" value={`${totals.fat}g`} />
          <Total label="Cost" value={formatAmount(totals.cost, currency)} />
        </div>
      )}
    </div>
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
