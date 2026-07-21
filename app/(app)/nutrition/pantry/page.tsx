"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Package, Wallet, TriangleAlert, Clock, MoreVertical, Pencil, Trash2, ShoppingCart, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getNutritionAll, getBudget, createShoppingItem, deletePantryItem, reorderPantry, type NutritionAll } from "@/lib/firebase/db";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { toFoodMap, pantryItemValue, pantryValue, stockStatus, expiryStatus, daysBetween } from "@/lib/food";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NutritionNav } from "@/components/nutrition/nutrition-nav";
import { PantryDialog } from "@/components/nutrition/pantry-dialog";
import { cn } from "@/lib/utils";
import type { PantryItem } from "@/lib/types";

type Sort = "custom" | "name" | "expiration" | "remaining" | "value";

export default function PantryPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [all, setAll] = useState<NutritionAll | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("custom");
  const [dialog, setDialog] = useState<{ open: boolean; item: PantryItem | null }>({ open: false, item: null });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

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
  const pantry = useMemo(() => all?.pantry ?? [], [all]);
  const cur = currency ?? resolveCurrency(null);

  const sorted = useMemo(() => {
    const list = [...pantry];
    switch (sort) {
      case "name": return list.sort((a, b) => a.name.localeCompare(b.name));
      case "expiration": return list.sort((a, b) => (a.expirationDate ?? "9999") < (b.expirationDate ?? "9999") ? -1 : 1);
      case "remaining": return list.sort((a, b) => a.quantityRemaining - b.quantityRemaining);
      case "value": return list.sort((a, b) => pantryItemValue(b, foodMap.get(b.foodId ?? "")) - pantryItemValue(a, foodMap.get(a.foodId ?? "")));
      default: return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
    }
  }, [pantry, sort, foodMap]);

  const totalValue = useMemo(() => pantryValue(pantry, foodMap), [pantry, foodMap]);
  const lowItems = useMemo(() => pantry.filter((p) => stockStatus(p) !== "ok"), [pantry]);
  const expiringItems = useMemo(() => pantry.filter((p) => { const e = expiryStatus(p, today); return e === "soon" || e === "expired"; }), [pantry, today]);
  const canReorder = sort === "custom";

  async function addToShopping(item: PantryItem) {
    if (!user) return;
    setAdded((s) => new Set(s).add(item.id));
    await createShoppingItem(user.uid, { foodId: item.foodId, name: item.name, unit: item.unit, quantity: item.quantity, estCost: null });
  }
  async function remove(item: PantryItem) {
    setAll((prev) => (prev ? { ...prev, pantry: prev.pantry.filter((p) => p.id !== item.id) } : prev));
    await deletePantryItem(item.id);
  }
  function dropOn(targetId: string) {
    if (!canReorder || !dragId || dragId === targetId) { setDragId(null); return; }
    const ids = sorted.map((p) => p.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, dragId);
    const byId = new Map(pantry.map((p) => [p.id, p]));
    setAll((prev) => (prev ? { ...prev, pantry: ids.map((id) => byId.get(id)!).filter(Boolean) } : prev));
    void reorderPantry(ids);
    setDragId(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <NutritionNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Package className="h-6 w-6 text-primary" /> Pantry</h1>
          <p className="text-muted-foreground">What you have on hand — drawn down automatically as you log meals.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, item: null })}><Plus className="h-4 w-4" /> Add item</Button>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={6} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile icon={<Wallet className="h-3.5 w-3.5" />} label="Pantry value" value={formatAmount(totalValue, cur)} />
            <Tile icon={<Package className="h-3.5 w-3.5" />} label="Items" value={String(pantry.length)} />
            <Tile icon={<TriangleAlert className="h-3.5 w-3.5" />} label="Running low" value={String(lowItems.length)} tone={lowItems.length ? "warn" : undefined} />
            <Tile icon={<Clock className="h-3.5 w-3.5" />} label="Expiring soon" value={String(expiringItems.length)} tone={expiringItems.length ? "warn" : undefined} />
          </div>

          {(lowItems.length > 0 || expiringItems.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {lowItems.length > 0 && (
                <AlertCard title="Running low" icon={<TriangleAlert className="h-4 w-4" />}>
                  {lowItems.slice(0, 6).map((p) => (
                    <AlertRow key={p.id} label={p.name} sub={`${p.quantityRemaining} ${p.unit} left`} added={added.has(p.id)} onAdd={() => addToShopping(p)} />
                  ))}
                </AlertCard>
              )}
              {expiringItems.length > 0 && (
                <AlertCard title="Expiring soon" icon={<Clock className="h-4 w-4" />}>
                  {expiringItems.slice(0, 6).map((p) => {
                    const d = p.expirationDate ? daysBetween(today, p.expirationDate) : 0;
                    return <AlertRow key={p.id} label={p.name} sub={d < 0 ? `expired ${-d}d ago` : d === 0 ? "expires today" : `in ${d}d`} added={added.has(p.id)} onAdd={() => addToShopping(p)} />;
                  })}
                </AlertCard>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">All items {pantry.length > 0 && `· ${pantry.length}`}</h2>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom order</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="expiration">Expiring soonest</SelectItem>
                <SelectItem value="remaining">Least remaining</SelectItem>
                <SelectItem value="value">Highest value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pantry.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Your pantry is empty</p>
              <p className="max-w-sm text-sm text-muted-foreground">Add what you have at home. As you log meals that use these foods, the amounts go down on their own.</p>
              <Button onClick={() => setDialog({ open: true, item: null })}><Plus className="h-4 w-4" /> Add your first item</Button>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Stock</th>
                      <th className="px-3 py-2 font-medium">Expires</th>
                      <th className="px-3 py-2 text-right font-medium">Value</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p) => {
                      const stock = stockStatus(p);
                      const exp = expiryStatus(p, today);
                      const days = p.expirationDate ? daysBetween(today, p.expirationDate) : null;
                      return (
                        <tr
                          key={p.id}
                          draggable={canReorder}
                          onDragStart={() => canReorder && setDragId(p.id)}
                          onDragEnd={() => setDragId(null)}
                          onDragOver={(e) => { if (canReorder && dragId) e.preventDefault(); }}
                          onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
                          className={cn("border-b last:border-0 transition hover:bg-accent/40", dragId === p.id && "opacity-40")}
                        >
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => setDialog({ open: true, item: p })} className="text-left font-medium hover:underline">{p.name}</button>
                            {!p.foodId && <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">ad-hoc</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className="tabular-nums">{p.quantityRemaining}{p.quantity ? <span className="text-muted-foreground">/{p.quantity}</span> : ""} {p.unit}</span>
                            {stock === "out" && <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px]">Out</Badge>}
                            {stock === "low" && <Badge variant="warning" className="ml-2 px-1.5 py-0 text-[10px]">Low</Badge>}
                          </td>
                          <td className="px-3 py-2">
                            {p.expirationDate ? (
                              <span className={cn("tabular-nums", exp === "expired" && "text-rose-500", exp === "soon" && "text-amber-500")}>
                                {p.expirationDate}{days != null && (exp === "soon" || exp === "expired") && <span className="ml-1 text-xs">({days < 0 ? `${-days}d ago` : days === 0 ? "today" : `${days}d`})</span>}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatAmount(pantryItemValue(p, foodMap.get(p.foodId ?? "")), cur)}</td>
                          <td className="px-1 py-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Item menu"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDialog({ open: true, item: p })}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addToShopping(p)}><ShoppingCart className="h-4 w-4" /> Add to shopping</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => remove(p)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {user && (
        <PantryDialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))} userId={user.uid} item={dialog.item} foods={foods} onSaved={() => load({ quiet: true })} />
      )}
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums", tone === "warn" && "text-amber-500")}>{value}</p>
    </Card>
  );
}

function AlertCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon} {title}</div>
      <div className="divide-y">{children}</div>
    </Card>
  );
}

function AlertRow({ label, sub, added, onAdd }: { label: string; sub: string; added: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate">{label} <span className="text-xs text-muted-foreground">· {sub}</span></span>
      <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-muted-foreground" onClick={onAdd} disabled={added}>
        {added ? <><Check className="h-3.5 w-3.5" /> Added</> : <><ShoppingCart className="h-3.5 w-3.5" /> Add</>}
      </Button>
    </div>
  );
}
