"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Star, Archive, Library } from "lucide-react";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { useAuth } from "@/components/auth-provider";
import { getFoods, getBudget, createFood, setFoodFavorite, setFoodArchived, deleteFood, reorderFoods } from "@/lib/firebase/db";
import { resolveCurrency, type Currency } from "@/lib/currency";
import { filterFoods, sortFoods, allFoodTags, FOOD_CATEGORIES, FOOD_SORTS, type FoodFilter, type FoodSort } from "@/lib/food";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FoodCard } from "@/components/nutrition/food-card";
import { FoodEditor } from "@/components/nutrition/food-editor";
import { cn } from "@/lib/utils";
import type { FoodItem } from "@/lib/types";

export default function FoodLibraryPage() {
  const { user } = useAuth();
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FoodFilter>({ search: "", category: null, tags: [], favorites: false, archived: false });
  const [sort, setSort] = useState<FoodSort>("custom");
  const [editor, setEditor] = useState<{ open: boolean; food: FoodItem | null }>({ open: false, food: null });
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [fs, budget] = await Promise.all([getFoods(user.uid), getBudget(user.uid)]);
      setFoods(fs);
      setCurrency(resolveCurrency(budget));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const tags = useMemo(() => allFoodTags(foods), [foods]);
  const visible = useMemo(() => sortFoods(filterFoods(foods, filter), sort), [foods, filter, sort]);
  const activeCount = foods.filter((f) => !f.archived).length;
  const canReorder = sort === "custom" && !filter.search && !filter.category && !filter.tags.length && !filter.favorites && !filter.archived;
  const cur = currency ?? resolveCurrency(null);

  function toggleTag(t: string) {
    setFilter((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }));
  }

  async function toggleFavorite(f: FoodItem) {
    setFoods((prev) => prev.map((x) => (x.id === f.id ? { ...x, favorite: !x.favorite } : x)));
    await setFoodFavorite(f.id, !f.favorite);
  }
  async function toggleArchive(f: FoodItem) {
    setFoods((prev) => prev.map((x) => (x.id === f.id ? { ...x, archived: !x.archived } : x)));
    await setFoodArchived(f.id, !f.archived);
  }
  async function remove(f: FoodItem) {
    setFoods((prev) => prev.filter((x) => x.id !== f.id));
    await deleteFood(f.id);
  }
  async function duplicate(f: FoodItem) {
    if (!user) return;
    await createFood(user.uid, {
      name: `${f.name} (copy)`, imageData: f.imageData, category: f.category, brand: f.brand, notes: f.notes,
      unit: f.unit, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat,
      purchasePrice: f.purchasePrice, quantityPurchased: f.quantityPurchased, currency: f.currency,
      servings: f.servings, tags: f.tags, favorite: false, sortOrder: foods.length,
    });
    await load({ quiet: true });
  }
  function dropOn(targetId: string) {
    if (!canReorder || !dragId || dragId === targetId) { setDragId(null); return; }
    const ids = visible.map((f) => f.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    const byId = new Map(foods.map((f) => [f.id, f]));
    setFoods(next.map((id) => byId.get(id)!).filter(Boolean));
    void reorderFoods(next);
    setDragId(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <NutritionNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Library className="h-6 w-6 text-primary" /> Food Library</h1>
          <p className="text-muted-foreground">Reusable foods with auto-calculated cost. {activeCount > 0 && `${activeCount} food${activeCount > 1 ? "s" : ""}.`}</p>
        </div>
        <Button onClick={() => setEditor({ open: true, food: null })}><Plus className="h-4 w-4" /> Add food</Button>
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder="Search foods…" className="pl-8" />
          </div>
          <Select value={filter.category ?? "all"} onValueChange={(v) => setFilter((f) => ({ ...f, category: v === "all" ? null : v }))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {FOOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as FoodSort)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>{FOOD_SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant={filter.favorites ? "default" : "outline"} size="icon" aria-label="Favorites only" onClick={() => setFilter((f) => ({ ...f, favorites: !f.favorites }))}>
            <Star className={cn("h-4 w-4", filter.favorites && "fill-current")} />
          </Button>
          <Button variant={filter.archived ? "default" : "outline"} size="icon" aria-label="Show archived" onClick={() => setFilter((f) => ({ ...f, archived: !f.archived }))}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => toggleTag(t)}>
                <Badge variant={filter.tags.includes(t) ? "default" : "secondary"} className="cursor-pointer font-normal">{t}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2"><SkeletonCard lines={2} /><SkeletonCard lines={2} /><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
          <Library className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{foods.length === 0 ? "Your Food Library is empty" : "No foods match your filters"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{foods.length === 0 ? "Add foods once, then reuse them in any meal — with cost per gram and per serving worked out for you." : "Try clearing search, category, or tag filters."}</p>
          {foods.length === 0 && <Button onClick={() => setEditor({ open: true, food: null })}><Plus className="h-4 w-4" /> Add your first food</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((f) => (
            <FoodCard
              key={f.id}
              food={f}
              defaultCurrency={cur}
              dragging={dragId === f.id}
              onEdit={() => setEditor({ open: true, food: f })}
              onDuplicate={() => duplicate(f)}
              onToggleFavorite={() => toggleFavorite(f)}
              onToggleArchive={() => toggleArchive(f)}
              onDelete={() => remove(f)}
              onDragStart={() => canReorder && setDragId(f.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { if (canReorder && dragId) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); dropOn(f.id); }}
            />
          ))}
        </div>
      )}

      {user && (
        <FoodEditor
          open={editor.open}
          onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}
          userId={user.uid}
          food={editor.food}
          defaultCurrency={cur.code}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
}
