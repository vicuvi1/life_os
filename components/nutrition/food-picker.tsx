"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Star, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FoodItem } from "@/lib/types";

interface Props {
  foods: FoodItem[];
  onPick: (food: FoodItem) => void;
  onCreateNew?: () => void;
}

/** Fast search over the library. Empty query surfaces favorites + recents so a
 * meal can be built in one click each. Stays focused after picking for rapid add. */
export function FoodPicker({ foods, onPick, onCreateNew }: Props) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const active = foods.filter((f) => !f.archived);
    const query = q.trim().toLowerCase();
    if (!query) {
      const favs = active.filter((f) => f.favorite);
      const rest = active.filter((f) => !f.favorite).sort((a, b) => b.createdAt - a.createdAt);
      return [...favs, ...rest].slice(0, 8);
    }
    return active
      .filter((f) => `${f.name} ${f.brand ?? ""} ${f.tags.join(" ")}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [foods, q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods to add…" className="pl-8" />
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-muted/20 p-1">
        {results.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            {q.trim() ? "No matching foods." : "No foods yet."}
            {onCreateNew && (
              <button type="button" onClick={onCreateNew} className="mt-1 block w-full text-primary underline">Create a food</button>
            )}
          </div>
        ) : (
          results.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { onPick(f); }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {f.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageData} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-medium">
                  {f.favorite && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                  {f.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {f.calories != null ? `${f.calories} kcal` : "—"}{f.protein != null ? ` · ${f.protein}P` : ""} <span className="opacity-60">/100{f.unit}</span>
                </span>
              </span>
              <Plus className={cn("h-4 w-4 shrink-0 text-muted-foreground")} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
