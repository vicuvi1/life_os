"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Luggage,
  Plus,
  Pencil,
  Trash2,
  Shirt,
  Check,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWardrobe,
  getPackingLists,
  updatePackingList,
  deletePackingList,
} from "@/lib/firebase/db";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PackingBuilderDialog } from "@/components/wardrobe/packing-builder-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem, PackingList } from "@/lib/types";

export default function PackingPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [lists, setLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<PackingList | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [w, pl] = await Promise.all([getWardrobe(user.uid), getPackingLists(user.uid)]);
      setItems(w.items);
      setLists(pl);
      setActiveId((prev) => prev ?? pl[0]?.id ?? null);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const active = useMemo(() => lists.find((l) => l.id === activeId) ?? null, [lists, activeId]);

  // Resolve an active list's items (skip any deleted from the wardrobe), grouped by category.
  const grouped = useMemo(() => {
    if (!active) return [];
    const resolved = active.itemIds
      .map((id) => itemsById.get(id))
      .filter((i): i is ClothingItem => Boolean(i));
    const map = new Map<string, ClothingItem[]>();
    for (const it of resolved) {
      const key = it.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map, ([category, its]) => ({ category, items: its }));
  }, [active, itemsById]);

  const packedSet = useMemo(() => new Set(active?.packed ?? []), [active]);
  const total = useMemo(
    () => (active ? active.itemIds.filter((id) => itemsById.has(id)).length : 0),
    [active, itemsById]
  );
  const packedCount = useMemo(
    () => (active ? active.itemIds.filter((id) => itemsById.has(id) && packedSet.has(id)).length : 0),
    [active, itemsById, packedSet]
  );

  function togglePacked(id: string) {
    if (!active) return;
    const next = new Set(active.packed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const packed = Array.from(next);
    setLists((prev) => prev.map((l) => (l.id === active.id ? { ...l, packed } : l)));
    void updatePackingList(active.id, { packed }).catch(() => void load({ quiet: true }));
  }

  function resetPacked() {
    if (!active) return;
    setLists((prev) => prev.map((l) => (l.id === active.id ? { ...l, packed: [] } : l)));
    void updatePackingList(active.id, { packed: [] }).catch(() => void load({ quiet: true }));
  }

  async function doDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(null);
    await deletePackingList(id);
    await load({ quiet: true });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Luggage className="h-6 w-6 text-primary" /> Packing lists
          </h1>
          <p className="text-muted-foreground">Plan what to bring, then tick it off as you pack.</p>
        </div>
        <Button onClick={() => { setEditing(null); setBuilderOpen(true); }} disabled={loading || items.length === 0}>
          <Plus className="h-4 w-4" /> New trip
        </Button>
      </div>

      {loading ? (
        <SkeletonCard lines={8} />
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Shirt className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Add some clothes first</p>
          <p className="max-w-sm text-sm text-muted-foreground">Packing lists are built from your wardrobe — add items, then plan a trip.</p>
          <Button asChild><Link href="/wardrobe">Go to wardrobe</Link></Button>
        </Card>
      ) : lists.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Luggage className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No trips yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Create a packing list for your next trip — pick the clothes and check them off as they go in the bag.</p>
          <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}><Plus className="h-4 w-4" /> Plan a trip</Button>
        </Card>
      ) : (
        <>
          {/* Trip selector */}
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => {
              const t = l.itemIds.filter((id) => itemsById.has(id)).length;
              const p = l.itemIds.filter((id) => itemsById.has(id) && l.packed.includes(id)).length;
              const done = t > 0 && p === t;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveId(l.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                    l.id === activeId ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
                  )}
                >
                  <span className="font-medium">{l.name}</span>
                  {l.days != null && <span className="text-xs text-muted-foreground">{l.days}d</span>}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground")}>
                    {p}/{t}
                  </span>
                </button>
              );
            })}
          </div>

          {active && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                <div>
                  <p className="font-semibold">{active.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {packedCount}/{total} packed{active.days != null ? ` · ${active.days} day${active.days === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={resetPacked} disabled={packedCount === 0}>
                    <RotateCcw className="h-4 w-4" /> Reset
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(active); setBuilderOpen(true); }}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={() => setDeleteId(active.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-muted">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (packedCount / total) * 100 : 0}%` }} />
              </div>

              <div className="space-y-4 p-4">
                {grouped.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    The items on this list were removed from your wardrobe. <button className="underline" onClick={() => { setEditing(active); setBuilderOpen(true); }}>Edit the trip</button> to add more.
                  </p>
                ) : (
                  grouped.map(({ category, items: its }) => (
                    <div key={category}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                      <div className="space-y-1">
                        {its.map((it) => {
                          const on = packedSet.has(it.id);
                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => togglePacked(it.id)}
                              className="flex w-full items-center gap-3 rounded-lg border px-2 py-1.5 text-left transition hover:bg-accent"
                            >
                              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-input")}>
                                {on && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                                {it.imageData ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={it.imageData} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center"><Shirt className="h-4 w-4 text-muted-foreground/40" /></span>
                                )}
                              </span>
                              <span className={cn("min-w-0 flex-1 truncate text-sm", on && "text-muted-foreground line-through")}>{it.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {user && (
        <PackingBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          userId={user.uid}
          items={items}
          existing={editing}
          onSaved={() => load({ quiet: true })}
        />
      )}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this trip?"
        description="The packing list will be removed. Your clothes aren't affected."
        confirmLabel="Delete"
        onConfirm={doDelete}
      />
    </div>
  );
}
