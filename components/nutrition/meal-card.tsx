"use client";

import { GripVertical, ChevronDown, ChevronRight, MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mealTotals, entryMacros, entryCost } from "@/lib/food";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { NutritionMeal } from "@/lib/types";

interface Props {
  meal: NutritionMeal;
  currency: Currency;
  dragging?: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function MealCard({ meal, currency, dragging, onToggleCollapse, onEdit, onDuplicate, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }: Props) {
  const accent = meal.color ?? "#6366f1";
  const t = mealTotals(meal);
  const chips = t.hasData
    ? ([
        t.calories > 0 ? `${t.calories} kcal` : null,
        t.protein > 0 ? `${t.protein}g protein` : null,
        t.cost > 0 ? formatAmount(t.cost, currency) : null,
      ].filter(Boolean) as string[])
    : [];
  const hasBody = meal.notes || meal.items.length > 0 || t.hasData;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("overflow-hidden", dragging && "opacity-40")}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
        <button type="button" onClick={onToggleCollapse} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `${accent}22` }}>{meal.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{meal.name}</span>
              {meal.time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meal.time}</span>}
            </span>
            {(chips.length > 0 || meal.items.length > 0) && (
              <span className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {meal.items.length > 0 && <span>{meal.items.length} food{meal.items.length > 1 ? "s" : ""}</span>}
                {chips.map((c) => <span key={c}>· {c}</span>)}
              </span>
            )}
          </span>
          {meal.collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
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
      </div>

      {!meal.collapsed && hasBody && (
        <div className="space-y-2 border-t px-3 py-2.5 pl-[52px] text-sm">
          {meal.items.length > 0 && (
            <div className="space-y-1">
              {meal.items.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-foreground">{e.name}</span>
                    <span className="text-muted-foreground"> · {e.quantity} × {e.servingLabel || `${e.servingGrams}${e.unit}`}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(entryMacros(e).calories)} kcal · {formatAmount(entryCost(e), currency)}</span>
                </div>
              ))}
            </div>
          )}
          {t.hasData && (
            <div className="flex flex-wrap gap-1.5">
              {t.calories > 0 && <MacroChip label={`${t.calories} kcal`} />}
              {t.protein > 0 && <MacroChip label={`${t.protein}g protein`} />}
              {t.carbs > 0 && <MacroChip label={`${t.carbs}g carbs`} />}
              {t.fat > 0 && <MacroChip label={`${t.fat}g fat`} />}
              {t.cost > 0 && <MacroChip label={formatAmount(t.cost, currency)} />}
            </div>
          )}
          {meal.notes && <p className="whitespace-pre-wrap text-muted-foreground">{meal.notes}</p>}
        </div>
      )}
    </Card>
  );
}

function MacroChip({ label }: { label: string }) {
  return <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{label}</span>;
}
