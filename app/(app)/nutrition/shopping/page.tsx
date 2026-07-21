"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ShoppingCart, GripVertical, X, Library, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNutritionAll, getBudget, createShoppingItem, updateShoppingItem, deleteShoppingItem,
  reorderShopping, clearPurchasedShopping, createPantryItem, type NutritionAll,
} from "@/lib/firebase/db";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { toFoodMap, shoppingItemCost, shoppingCost } from "@/lib/food";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { cn } from "@/lib/utils";
import type { ShoppingItem, FoodItem } from "@/lib/types";

type Sort = "custom" | "name" | "cost" | "todo" | "aisle";

/** Store sections, derived from each item's food category. */
const AISLES: { label: string; cats: string[] }[] = [
  { label: "🥬 Produce", cats: ["Vegetables", "Fruit"] },
  { label: "🥩 Meat & Protein", cats: ["Protein"] },
  { label: "🥛 Dairy", cats: ["Dairy"] },
  { label: "🌾 Grains & Pantry", cats: ["Grains", "Condiments", "Fats & Oils", "Nuts & Seeds", "Supplements"] },
  { label: "🍿 Snacks & Drinks", cats: ["Snacks", "Drinks"] },
  { label: "🍱 Prepared", cats: ["Prepared"] },
  { label: "🛒 Other", cats: [] },
];

export default function ShoppingPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("custom");
  const [quick, setQuick] = useState("");
  const [picking, setPicking] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [data, budget] = await Promise.all([getNutritionAll(user.uid), getBudget(user.uid)]);
      setAll(data);
      setCurrency(resolveCurrency(budget));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const foods = useMemo(() => all?.foods ?? [], [all]);
  const foodMap = useMemo(() => toFoodMap(foods), [foods]);
  const items = useMemo(() => all?.shopping ?? [], [all]);
  const cur = currency ?? resolveCurrency(null);

  const sorted = useMemo(() => {
    const list = [...items];
    switch (sort) {
      case "name": return list.sort((a, b) => a.name.localeCompare(b.name));
      case "cost": return list.sort((a, b) => shoppingItemCost(b, foodMap.get(b.foodId ?? "")) - shoppingItemCost(a, foodMap.get(a.foodId ?? "")));
      case "todo": return list.sort((a, b) => Number(a.purchased) - Number(b.purchased) || a.sortOrder - b.sortOrder);
      default: return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
    }
  }, [items, sort, foodMap]);

  const remainingCost = useMemo(() => shoppingCost(items, foodMap, { unpurchasedOnly: true }), [items, foodMap]);
  const purchased = items.filter((i) => i.purchased);
  const canReorder = sort === "custom";

  // Aisle groups (only in "aisle" mode): section label → its items.
  const aisleGroups = useMemo(() => {
    if (sort !== "aisle") return null;
    const of = (i: ShoppingItem) => {
      const cat = foodMap.get(i.foodId ?? "")?.category;
      const aisle = cat ? AISLES.find((a) => a.cats.includes(cat)) : undefined;
      return aisle?.label ?? "🛒 Other";
    };
    return AISLES.map((a) => ({ label: a.label, items: sorted.filter((i) => of(i) === a.label) })).filter((g) => g.items.length > 0);
  }, [sort, sorted, foodMap]);

  function setLocal(next: ShoppingItem[]) { setAll((prev) => (prev ? { ...prev, shopping: next } : prev)); }
  function patch(id: string, p: Partial<ShoppingItem>) { setLocal(items.map((i) => (i.id === id ? { ...i, ...p } : i))); }

  async function addManual() {
    if (!user || !quick.trim()) return;
    const name = quick.trim();
    setQuick("");
    await createShoppingItem(user.uid, { foodId: null, name, unit: null, quantity: null, estCost: null, sortOrder: items.length });
    await load({ quiet: true });
  }
  async function addFood(f: FoodItem) {
    if (!user) return;
    await createShoppingItem(user.uid, { foodId: f.id, name: f.name, unit: f.unit, quantity: f.quantityPurchased, estCost: f.purchasePrice, sortOrder: items.length });
    await load({ quiet: true });
  }
  async function togglePurchased(item: ShoppingItem) {
    patch(item.id, { purchased: !item.purchased });
    await updateShoppingItem(item.id, { purchased: !item.purchased });
  }
  async function remove(item: ShoppingItem) {
    setLocal(items.filter((i) => i.id !== item.id));
    await deleteShoppingItem(item.id);
  }
  async function commitField(item: ShoppingItem, field: "name" | "quantity" | "estCost", raw: string) {
    if (field === "name") { if (raw.trim() === item.name) return; await updateShoppingItem(item.id, { name: raw.trim() || item.name }); }
    else { const v = raw.trim() === "" ? null : Math.max(0, Number(raw)) || (Number(raw) === 0 ? 0 : null); await updateShoppingItem(item.id, { [field]: v }); }
  }
  async function clearPurchased() {
    setBusy(true);
    try { await clearPurchasedShopping(purchased.map((i) => i.id)); await load({ quiet: true }); } finally { setBusy(false); }
  }
  async function restockToPantry() {
    if (!user) return;
    setBusy(true);
    try {
      for (const i of purchased) {
        await createPantryItem(user.uid, {
          foodId: i.foodId, name: i.name, unit: i.unit ?? "g",
          quantity: i.quantity, quantityRemaining: i.quantity ?? 0,
          purchaseDate: today, expirationDate: null, purchasePrice: i.estCost, lowThreshold: null,
        });
      }
      await clearPurchasedShopping(purchased.map((i) => i.id));
      await load({ quiet: true });
    } finally { setBusy(false); }
  }
  function dropOn(targetId: string) {
    if (!canReorder || !dragId || dragId === targetId) { setDragId(null); return; }
    const ids = sorted.map((i) => i.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, dragId);
    const byId = new Map(items.map((i) => [i.id, i]));
    setLocal(ids.map((id) => byId.get(id)!).filter(Boolean));
    void reorderShopping(ids);
    setDragId(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <NutritionNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><ShoppingCart className="h-6 w-6 text-primary" /> Shopping list</h1>
          <p className="text-muted-foreground">Estimated remaining: <span className="font-semibold text-foreground">{formatAmount(remainingCost, cur)}</span></p>
        </div>
      </div>

      {loading ? (
        <SkeletonCard lines={6} />
      ) : (
        <>
          {/* Quick add */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addManual(); }} placeholder="Add an item and press Enter…" className="pl-8" />
            </div>
            <Button variant="outline" onClick={() => setPicking((p) => !p)}><Library className="h-4 w-4" /> From library</Button>
          </div>
          {picking && <FoodPicker foods={foods} onPick={addFood} />}

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nothing on the list</p>
              <p className="max-w-sm text-sm text-muted-foreground">Add items above, or send low / expiring foods here from your Pantry.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{items.length} item{items.length > 1 ? "s" : ""}{purchased.length > 0 && ` · ${purchased.length} in cart`}</span>
                <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom order</SelectItem>
                    <SelectItem value="aisle">By store aisle</SelectItem>
                    <SelectItem value="todo">To-buy first</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                    <SelectItem value="cost">Cost (high→low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="divide-y overflow-hidden">
                {(aisleGroups ?? [{ label: null as string | null, items: sorted }]).map((group) => (
                  <div key={group.label ?? "_all"}>
                    {group.label && (
                      <div className="flex items-center justify-between bg-muted/30 px-2.5 py-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{formatAmount(shoppingCost(group.items, foodMap, { unpurchasedOnly: true }), cur)}</p>
                      </div>
                    )}
                    <div className="divide-y">
                      {group.items.map((item) => {
                        const est = shoppingItemCost(item, foodMap.get(item.foodId ?? ""));
                        return (
                          <div
                            key={item.id}
                            draggable={canReorder}
                            onDragStart={() => canReorder && setDragId(item.id)}
                            onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => { if (canReorder && dragId) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); dropOn(item.id); }}
                            className={cn("flex items-center gap-2 px-2.5 py-2", dragId === item.id && "opacity-40", item.purchased && "bg-muted/30")}
                          >
                            {canReorder && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30" />}
                            <Checkbox checked={item.purchased} onCheckedChange={() => togglePurchased(item)} aria-label="Purchased" />
                            <input
                              defaultValue={item.name}
                              onBlur={(e) => commitField(item, "name", e.target.value)}
                              className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", item.purchased && "text-muted-foreground line-through")}
                            />
                            <input
                              type="number" min={0} defaultValue={item.quantity ?? ""}
                              onBlur={(e) => commitField(item, "quantity", e.target.value)}
                              placeholder="qty"
                              className="w-14 rounded border bg-transparent px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:border-primary"
                            />
                            <span className="w-6 shrink-0 text-xs text-muted-foreground">{item.unit ?? ""}</span>
                            <div className="relative w-20 shrink-0">
                              <input
                                type="number" min={0} step="0.01" defaultValue={item.estCost ?? ""}
                                onBlur={(e) => commitField(item, "estCost", e.target.value)}
                                placeholder={est ? String(est) : "cost"}
                                className="w-full rounded border bg-transparent px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:border-primary"
                              />
                            </div>
                            <button type="button" onClick={() => remove(item)} className="shrink-0 p-1 text-muted-foreground hover:text-rose-500" aria-label="Remove"><X className="h-4 w-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Card>

              {purchased.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-4 w-4" /> {purchased.length} purchased</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={restockToPantry} disabled={busy}>Add to pantry</Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearPurchased} disabled={busy}>Clear</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
