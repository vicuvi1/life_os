"use client";

import { GripVertical, ChevronDown, ChevronRight, MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NutritionMeal } from "@/lib/types";

interface Props {
  meal: NutritionMeal;
  currencySymbol?: string;
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

export function MealCard({ meal, currencySymbol, dragging, onToggleCollapse, onEdit, onDuplicate, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }: Props) {
  const accent = meal.color ?? "#6366f1";
  const chips = [
    meal.calories != null ? `${meal.calories} kcal` : null,
    meal.protein != null ? `${meal.protein}g protein` : null,
    meal.cost != null ? `${currencySymbol ?? ""}${meal.cost}` : null,
  ].filter(Boolean) as string[];

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
            {chips.length > 0 && (
              <span className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">{chips.map((c) => <span key={c}>{c}</span>)}</span>
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
      {!meal.collapsed && (meal.notes || chips.length > 0) && (
        <div className="space-y-1.5 border-t px-3 py-2.5 pl-[52px] text-sm">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{c}</span>)}
            </div>
          )}
          {meal.notes && <p className="whitespace-pre-wrap text-muted-foreground">{meal.notes}</p>}
        </div>
      )}
    </Card>
  );
}
