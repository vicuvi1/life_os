"use client";

import { Star, MoreVertical, Pencil, Copy, Archive, ArchiveRestore, Trash2, Utensils } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { costPerServing } from "@/lib/food";
import { CURRENCIES, formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { FoodItem } from "@/lib/types";

interface Props {
  food: FoodItem;
  defaultCurrency: Currency;
  dragging?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function FoodCard({ food, defaultCurrency, dragging, onEdit, onDuplicate, onToggleFavorite, onToggleArchive, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }: Props) {
  const cur = CURRENCIES.find((c) => c.code === food.currency) ?? defaultCurrency;
  const serving = food.servings[0];
  const cps = serving ? costPerServing(food, serving) : null;
  const macros = [
    food.calories != null ? `${food.calories} kcal` : null,
    food.protein != null ? `${food.protein}P` : null,
    food.carbs != null ? `${food.carbs}C` : null,
    food.fat != null ? `${food.fat}F` : null,
  ].filter(Boolean) as string[];

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("group flex gap-3 p-3 transition", dragging && "opacity-40", food.archived && "opacity-70")}
    >
      <button type="button" onClick={onEdit} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted" aria-label={`Edit ${food.name}`}>
        {food.imageData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={food.imageData} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground"><Utensils className="h-5 w-5" /></span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-1.5 truncate font-medium leading-tight">
              {food.name}
              {food.archived && <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">Archived</span>}
            </p>
            {(food.brand || food.category) && (
              <p className="truncate text-xs text-muted-foreground">{[food.brand, food.category].filter(Boolean).join(" · ")}</p>
            )}
          </button>
          <button type="button" onClick={onToggleFavorite} aria-label={food.favorite ? "Unfavorite" : "Favorite"} className="shrink-0 p-0.5">
            <Star className={cn("h-4 w-4 transition", food.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400")} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" aria-label="Food menu"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleFavorite}><Star className="h-4 w-4" /> {food.favorite ? "Unfavorite" : "Favorite"}</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>{food.archived ? <><ArchiveRestore className="h-4 w-4" /> Unarchive</> : <><Archive className="h-4 w-4" /> Archive</>}</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {macros.length > 0 ? <span className="tabular-nums">{macros.join(" · ")} <span className="opacity-60">/100{food.unit}</span></span> : <span className="italic opacity-70">No macros yet</span>}
          {cps != null && serving && <span className="ml-auto shrink-0 font-medium text-foreground tabular-nums">{formatAmount(cps, cur)} / {serving.label}</span>}
        </div>

        {food.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {food.tags.slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{t}</Badge>)}
          </div>
        )}
      </div>
    </Card>
  );
}
