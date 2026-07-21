"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, BookOpen, Search, Star, Archive, MoreVertical, Pencil, Copy, ArchiveRestore, Trash2, CalendarPlus, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionAll, getBudget, createRecipe, updateRecipe, deleteRecipe, reorderRecipes,
  createNutritionMeal, type NutritionAll,
} from "@/lib/firebase/db";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { toFoodMap, recipeTotals, genId } from "@/lib/food";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { RecipeEditor } from "@/components/nutrition/recipe-editor";
import { cn } from "@/lib/utils";
import type { Recipe, RecipeKind } from "@/lib/types";

type KindFilter = "all" | "recipe" | "template";
type Sort = "custom" | "name" | "cost" | "recent";

export default function RecipesPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [collection, setCollection] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("custom");
  const [editor, setEditor] = useState<{ open: boolean; recipe: Recipe | null; kind: RecipeKind }>({ open: false, recipe: null, kind: "recipe" });
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [data, budget] = await Promise.all([getNutritionAll(user.uid), getBudget(user.uid)]);
      setAll(data);
      setCurrency(resolveCurrency(budget));
    } finally { if (!opts?.quiet) setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const recipes = useMemo(() => all?.recipes ?? [], [all]);
  const foods = useMemo(() => all?.foods ?? [], [all]);
  const foodMap = useMemo(() => toFoodMap(foods), [foods]);
  const cur = currency ?? resolveCurrency(null);
  const collections = useMemo(() => [...new Set(recipes.map((r) => r.collection).filter(Boolean) as string[])].sort(), [recipes]);
  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort(), [recipes]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = recipes.filter((r) => {
      if (archived ? !r.archived : r.archived) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (favorites && !r.favorite) return false;
      if (collection && r.collection !== collection) return false;
      if (q && !`${r.name} ${r.tags.join(" ")} ${r.collection ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    switch (sort) {
      case "name": list = list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "cost": list = list.sort((a, b) => recipeTotals(a, foodMap).cost - recipeTotals(b, foodMap).cost); break;
      case "recent": list = list.sort((a, b) => b.createdAt - a.createdAt); break;
      default: list = list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
    }
    return list;
  }, [recipes, search, kind, favorites, collection, archived, sort, foodMap]);

  const canReorder = sort === "custom" && !search && kind === "all" && !collection && !favorites && !archived;

  async function toggleFavorite(r: Recipe) {
    setAll((p) => (p ? { ...p, recipes: p.recipes.map((x) => (x.id === r.id ? { ...x, favorite: !x.favorite } : x)) } : p));
    await updateRecipe(r.id, { favorite: !r.favorite });
  }
  async function toggleArchive(r: Recipe) {
    setAll((p) => (p ? { ...p, recipes: p.recipes.map((x) => (x.id === r.id ? { ...x, archived: !x.archived } : x)) } : p));
    await updateRecipe(r.id, { archived: !r.archived });
  }
  async function remove(r: Recipe) {
    setAll((p) => (p ? { ...p, recipes: p.recipes.filter((x) => x.id !== r.id) } : p));
    await deleteRecipe(r.id);
  }
  async function duplicate(r: Recipe) {
    if (!user) return;
    await createRecipe(user.uid, { kind: r.kind, name: `${r.name} (copy)`, imageData: r.imageData, notes: r.notes, items: r.items, collection: r.collection, tags: r.tags, favorite: false, sortOrder: recipes.length });
    await load({ quiet: true });
  }
  async function logToday(r: Recipe) {
    if (!user) return;
    setLogged((s) => new Set(s).add(r.id));
    await createNutritionMeal(user.uid, today, {
      name: r.name, icon: r.kind === "template" ? "🍽️" : "🥘", color: null, time: null, notes: r.notes,
      items: r.items.map((e, idx) => ({ ...e, id: genId(), sortOrder: idx })),
      calories: null, protein: null, carbs: null, fat: null, cost: null,
    });
  }
  function dropOn(targetId: string) {
    if (!canReorder || !dragId || dragId === targetId) { setDragId(null); return; }
    const ids = visible.map((r) => r.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, dragId);
    const byId = new Map(recipes.map((r) => [r.id, r]));
    setAll((p) => (p ? { ...p, recipes: ids.map((id) => byId.get(id)!).filter(Boolean) } : p));
    void reorderRecipes(ids);
    setDragId(null);
  }

  function openNew() {
    setEditor({ open: true, recipe: null, kind: kind === "template" ? "template" : "recipe" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <NutritionNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><BookOpen className="h-6 w-6 text-primary" /> Recipes &amp; templates</h1>
          <p className="text-muted-foreground">Reusable dishes and one-tap meals — built from your Food Library.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New</Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="recipe">Recipes</SelectItem><SelectItem value="template">Templates</SelectItem></SelectContent>
          </Select>
          {collections.length > 0 && (
            <Select value={collection ?? "all"} onValueChange={(v) => setCollection(v === "all" ? null : v)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All collections</SelectItem>{collections.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="custom">Custom order</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="cost">Cost</SelectItem><SelectItem value="recent">Recent</SelectItem></SelectContent>
          </Select>
          <Button variant={favorites ? "default" : "outline"} size="icon" aria-label="Favorites" onClick={() => setFavorites((v) => !v)}><Star className={cn("h-4 w-4", favorites && "fill-current")} /></Button>
          <Button variant={archived ? "default" : "outline"} size="icon" aria-label="Archived" onClick={() => setArchived((v) => !v)}><Archive className="h-4 w-4" /></Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => setSearch(t)}><Badge variant="secondary" className="cursor-pointer font-normal">{t}</Badge></button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2"><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{recipes.length === 0 ? "No recipes or templates yet" : "Nothing matches your filters"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{recipes.length === 0 ? "Save a dish once (Chicken Rice Bowl) or a quick-log meal (Protein Lunch) and reuse it any day." : "Try clearing search or filters."}</p>
          {recipes.length === 0 && <Button onClick={openNew}><Plus className="h-4 w-4" /> Create your first</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((r) => {
            const t = recipeTotals(r, foodMap);
            return (
              <Card
                key={r.id}
                draggable={canReorder}
                onDragStart={() => canReorder && setDragId(r.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => { if (canReorder && dragId) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); dropOn(r.id); }}
                className={cn("flex flex-col gap-2 p-3", dragId === r.id && "opacity-40", r.archived && "opacity-70")}
              >
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditor({ open: true, recipe: r, kind: r.kind })} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-xl" aria-label={`Edit ${r.name}`}>
                    {r.imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageData} alt="" className="h-full w-full object-cover" />
                    ) : (r.kind === "template" ? "🍽️" : "🥘")}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1">
                      <button type="button" onClick={() => setEditor({ open: true, recipe: r, kind: r.kind })} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium leading-tight">{r.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant={r.kind === "template" ? "default" : "secondary"} className="px-1.5 py-0 text-[10px]">{r.kind === "template" ? "Template" : "Recipe"}</Badge>
                          {r.collection && <span className="truncate text-xs text-muted-foreground">{r.collection}</span>}
                        </p>
                      </button>
                      <button type="button" onClick={() => toggleFavorite(r)} aria-label="Favorite" className="shrink-0 p-0.5"><Star className={cn("h-4 w-4", r.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400")} /></button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" aria-label="Menu"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditor({ open: true, recipe: r, kind: r.kind })}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(r)}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleArchive(r)}>{r.archived ? <><ArchiveRestore className="h-4 w-4" /> Unarchive</> : <><Archive className="h-4 w-4" /> Archive</>}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => remove(r)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {r.items.length} food{r.items.length === 1 ? "" : "s"} · {t.calories} kcal · {t.protein}P · {formatAmount(t.cost, cur)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => logToday(r)} disabled={logged.has(r.id) || r.items.length === 0}>
                  {logged.has(r.id) ? <><Check className="h-4 w-4" /> Logged today</> : <><CalendarPlus className="h-4 w-4" /> Log to today</>}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {user && (
        <RecipeEditor
          open={editor.open}
          onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}
          userId={user.uid}
          recipe={editor.recipe}
          defaultKind={editor.kind}
          collections={collections}
          foods={foods}
          currency={cur}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
}
