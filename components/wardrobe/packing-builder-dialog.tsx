"use client";

import { useEffect, useMemo, useState } from "react";
import { Shirt, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPackingList, updatePackingList } from "@/lib/firebase/db";
import { categoriesInUse, filterItems } from "@/lib/wardrobe";
import { cn } from "@/lib/utils";
import type { ClothingItem, PackingList } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  items: ClothingItem[];
  /** Present when editing an existing trip. */
  existing?: PackingList | null;
  onSaved: () => void;
}

/** Create or edit a trip packing list — name it and pick what to bring. */
export function PackingBuilderDialog({ open, onOpenChange, userId, items, existing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDays(existing?.days != null ? String(existing.days) : "");
    setSelected(new Set(existing?.itemIds ?? []));
    setQuery("");
    setCategory(null);
  }, [open, existing]);

  const categories = useMemo(() => categoriesInUse(items.filter((i) => !i.retired)), [items]);
  const visible = useMemo(() => filterItems(items, { query, category, includeRetired: false }), [items, query, category]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!userId || !name.trim() || selected.size === 0) return;
    setSaving(true);
    try {
      const parsedDays = days.trim() ? Math.max(1, Math.round(Number(days))) : null;
      const itemIds = Array.from(selected);
      if (existing) {
        await updatePackingList(existing.id, {
          name: name.trim(),
          days: Number.isFinite(parsedDays as number) ? parsedDays : null,
          itemIds,
          // Drop packed ids that are no longer in the list.
          packed: existing.packed.filter((id) => selected.has(id)),
        });
      } else {
        await createPackingList(userId, {
          name: name.trim(),
          days: Number.isFinite(parsedDays as number) ? parsedDays : null,
          itemIds,
        });
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit trip" : "New trip"}</DialogTitle>
          <DialogDescription>Name the trip and pick the clothes you want to bring.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1 space-y-1">
            <Label htmlFor="pk-name" className="text-xs">Trip name</Label>
            <Input id="pk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vienna weekend" className="h-9" />
          </div>
          <div className="w-24 space-y-1">
            <Label htmlFor="pk-days" className="text-xs">Days</Label>
            <Input id="pk-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="—" className="h-9" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 min-w-[140px] flex-1" />
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCategory(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All</button>
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(category === c ? null : c)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category === c ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{c}</button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No matching items.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {visible.map((item) => {
              const on = selected.has(item.id);
              return (
                <button key={item.id} type="button" onClick={() => toggle(item.id)} className={cn("relative overflow-hidden rounded-xl border text-left transition", on ? "ring-2 ring-primary" : "hover:border-primary/40")}>
                  <div className="aspect-square w-full bg-muted/40">
                    {item.imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageData} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Shirt className="h-8 w-8 text-muted-foreground/40" /></div>
                    )}
                  </div>
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>
                  )}
                  <p className="truncate px-1.5 py-1 text-[11px] font-medium">{item.name}</p>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !name.trim() || selected.size === 0}>
            {saving ? "Saving…" : existing ? "Save trip" : `Create trip (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
