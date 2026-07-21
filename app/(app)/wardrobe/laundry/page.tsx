"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { WashingMachine, CheckSquare, Square } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getWardrobe, updateClothing, bulkUpdateClothingStatus } from "@/lib/firebase/db";
import { STATUS_META, WARDROBE_STATUSES, statusCounts } from "@/lib/wardrobe";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemCard } from "@/components/wardrobe/item-card";
import { cn } from "@/lib/utils";
import type { ClothingItem, WardrobeStatus } from "@/lib/types";

type LaundryTab = "laundry" | WardrobeStatus | "needsIroning";

const TABS: { key: LaundryTab; label: string }[] = [
  { key: "laundry", label: "All laundry" },
  { key: "dirty", label: "Dirty" },
  { key: "washing", label: "Washing" },
  { key: "drying", label: "Drying" },
  { key: "ready", label: "Ready" },
  { key: "needsIroning", label: "Needs ironing" },
  { key: "clean", label: "Clean" },
  { key: "worn", label: "Worn" },
];

function LaundryInner() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LaundryTab>("laundry");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = search?.get("status");
    if (s && (s === "needsIroning" || (WARDROBE_STATUSES as string[]).includes(s))) setTab(s as LaundryTab);
  }, [search]);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      setItems((await getWardrobe(user.uid)).items);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => statusCounts(items), [items]);
  const visible = useMemo(() => {
    const active = items.filter((i) => !i.retired);
    if (tab === "laundry") return active.filter((i) => ["dirty", "washing", "drying", "ready"].includes(i.status));
    if (tab === "needsIroning") return active.filter((i) => i.needsIroning);
    return active.filter((i) => i.status === tab);
  }, [items, tab]);

  const selectedIds = useMemo(() => visible.filter((i) => selected.has(i.id)).map((i) => i.id), [visible, selected]);
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;

  function patchLocal(ids: string[], patch: Partial<ClothingItem>) {
    const set = new Set(ids);
    setItems((prev) => prev.map((i) => (set.has(i.id) ? { ...i, ...patch } : i)));
  }

  async function bulk(patch: { status?: WardrobeStatus; needsIroning?: boolean }) {
    if (selectedIds.length === 0) return;
    setBusy(true);
    patchLocal(selectedIds, patch);
    setSelected(new Set());
    try {
      await bulkUpdateClothingStatus(selectedIds, patch);
    } catch {
      await load({ quiet: true });
    } finally {
      setBusy(false);
    }
  }

  function tabCount(t: LaundryTab): number {
    if (t === "laundry") return counts.dirty + counts.washing + counts.drying + counts.ready;
    if (t === "needsIroning") return counts.needsIroning;
    return counts[t];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <WashingMachine className="h-6 w-6 text-primary" /> Laundry
        </h1>
        <p className="text-muted-foreground">Track the wash cycle — select several items to move them together.</p>
      </div>

      {/* Tabs (filtered views over the same items — not separate lists) */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSelected(new Set()); }}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent"
            )}
          >
            {t.label}
            <span className={cn("tabular-nums", tab === t.key ? "text-primary-foreground/80" : "text-muted-foreground/70")}>{tabCount(t.key)}</span>
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {visible.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.id)))}
          >
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allSelected ? "Clear" : "Select all"}
          </Button>
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {(["dirty", "washing", "drying", "ready", "clean"] as WardrobeStatus[]).map((s) => (
              <Button key={s} size="sm" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => bulk({ status: s })} className="h-8 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                {STATUS_META[s].label}
              </Button>
            ))}
            <Button size="sm" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => bulk({ needsIroning: true })} className="h-8 text-xs">👔 Flag ironing</Button>
            <Button size="sm" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => bulk({ needsIroning: false })} className="h-8 text-xs">Ironed</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <SkeletonCard lines={8} />
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <WashingMachine className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nothing here</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {tab === "laundry" ? "No items are in the wash cycle right now — enjoy it while it lasts." : "No items with this status."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onSelect={(it) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(it.id)) next.delete(it.id);
                  else next.add(it.id);
                  return next;
                })
              }
              onStatusChange={(it, patch) => {
                patchLocal([it.id], patch);
                void updateClothing(it.id, patch).catch(() => void load({ quiet: true }));
              }}
              onToggleFavorite={(it) => {
                patchLocal([it.id], { favorite: !it.favorite });
                void updateClothing(it.id, { favorite: !it.favorite }).catch(() => void load({ quiet: true }));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LaundryPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <LaundryInner />
    </Suspense>
  );
}
