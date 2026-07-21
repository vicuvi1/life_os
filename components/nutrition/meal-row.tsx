"use client";

import { GripVertical, MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { mealTotals, entryGrams, type FoodMap } from "@/lib/food";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { NutritionMeal, MealFoodEntry } from "@/lib/types";

interface Props {
  meal: NutritionMeal;
  foods: FoodMap;
  currency: Currency;
  dragging?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function foodLine(e: MealFoodEntry, foods: FoodMap): string {
  const name = foods.get(e.foodId)?.name ?? e.name;
  const qty = e.quantity !== 1 ? `${e.quantity} ` : "";
  return `${qty}${name} (${Math.round(entryGrams(e))}${e.unit})`;
}

export function MealRow({ meal, foods, currency, dragging, onEdit, onDuplicate, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }: Props) {
  const t = mealTotals(meal, foods);
  const accent = meal.color ?? "#6366f1";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3 transition hover:bg-accent/30", dragging && "opacity-40")}
    >
      {/* Time + icon + name/foods */}
      <div className="flex min-w-[200px] flex-1 items-start gap-2.5">
        <GripVertical className="mt-2 hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30 active:cursor-grabbing sm:block" />
        <span className="w-10 shrink-0 pt-1.5 text-xs tabular-nums text-muted-foreground">{meal.time || "--:--"}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `${accent}26` }}>{meal.icon}</span>
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <p className="font-semibold leading-tight">{meal.name || "Meal"}</p>
          {meal.items.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {meal.items.map((e) => <li key={e.id}>• {foodLine(e, foods)}</li>)}
            </ul>
          ) : meal.notes ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{meal.notes}</p>
          ) : null}
        </button>
      </div>

      {/* Macros */}
      {t.hasData && (
        <div className="flex items-center gap-3 pl-12 sm:gap-4 sm:pl-0">
          <Macro value={String(t.calories)} label="kcal" />
          <Macro value={`${t.protein}g`} label="Protein" />
          <Macro value={`${t.carbs}g`} label="Carbs" />
          <Macro value={`${t.fat}g`} label="Fat" />
        </div>
      )}

      {/* Cost + menu */}
      <div className="ml-auto flex items-center gap-1">
        {t.cost > 0 && <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatAmount(t.cost, currency)}</span>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Meal menu"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Macro({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
