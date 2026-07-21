"use client";

import { GripVertical, MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mealTotals, entryGrams } from "@/lib/food";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { NutritionMeal, MealFoodEntry } from "@/lib/types";
import type { FoodMap } from "@/lib/food";

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

function amountText(e: MealFoodEntry): string {
  // Named servings (e.g. "1 Egg") read best as a count; weight servings as grams.
  if (e.servingLabel && !/^100\s/.test(e.servingLabel)) {
    return e.quantity === 1 ? e.servingLabel : `${e.quantity} × ${e.servingLabel}`;
  }
  return `${Math.round(entryGrams(e))}${e.unit}`;
}

export function MealCard({ meal, foods, currency, dragging, onEdit, onDuplicate, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }: Props) {
  const t = mealTotals(meal, foods);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("flex gap-3 p-3 transition", dragging && "opacity-40")}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30 active:cursor-grabbing" />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">{meal.icon}</span>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{meal.name || "Meal"}</span>
          {meal.time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meal.time}</span>}
        </span>

        {meal.items.length > 0 ? (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
            {meal.items.map((e) => {
              const food = foods.get(e.foodId);
              return (
                <span key={e.id} className={cn(!food && "line-through")}>
                  {food?.name ?? e.name} <span className="text-muted-foreground/60">{amountText(e)}</span>
                </span>
              );
            })}
          </span>
        ) : meal.notes ? (
          <span className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{meal.notes}</span>
        ) : null}

        {t.hasData && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
            {t.calories > 0 && <span className="font-semibold">{t.calories} kcal</span>}
            {t.protein > 0 && <span className="text-muted-foreground">{t.protein}g protein</span>}
            {t.cost > 0 && <span className="text-muted-foreground">{formatAmount(t.cost, currency)}</span>}
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Meal menu"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
