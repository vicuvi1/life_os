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
import { confirmWear, upsertWearLog, createOutfit } from "@/lib/firebase/db";
import { categoriesInUse, filterItems, isWearable } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ClothingItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  items: ClothingItem[];
  /** Date to assign (YYYY-MM-DD). Today = confirm wear; future = plan. */
  date: string;
  /** Pre-selected item ids (e.g. re-planning an existing day). */
  initialIds?: string[];
  onSaved: () => void;
}

/** Pick items for a day — wear it now (today) or plan it (future date). */
export function WearPickerDialog({ open, onOpenChange, userId, items, date, initialIds, onSaved }: Props) {
  const today = toDateKey(new Date());
  const isToday = date === today;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cleanOnly, setCleanOnly] = useState(true);
  const [saveAsOutfit, setSaveAsOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [asTemplate, setAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialIds ?? []));
    setQuery("");
    setCategory(null);
    setCleanOnly(true);
    setSaveAsOutfit(false);
    setOutfitName("");
    setAsTemplate(false);
  }, [open, initialIds]);

  const categories = useMemo(() => categoriesInUse(items), [items]);
  const visible = useMemo(() => {
    const base = filterItems(items, { query, category, includeRetired: false });
    return cleanOnly ? base.filter((i) => isWearable(i) || selected.has(i.id)) : base;
  }, [items, query, category, cleanOnly, selected]);

  function toggle(item: ClothingItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  async function save() {
    if (!userId || selected.size === 0) return;
    setSaving(true);
    try {
      const chosen = items.filter((i) => selected.has(i.id));
      let outfitId: string | null = null;
      if (saveAsOutfit && outfitName.trim()) {
        outfitId = await createOutfit(userId, {
          name: outfitName.trim(),
          type: asTemplate ? "template" : "custom",
          itemIds: chosen.map((i) => i.id),
          occasions: [],
          rating: null,
          weatherFit: null,
          notes: null,
          favorite: false,
        });
      }
      if (isToday) {
        await confirmWear(userId, date, chosen, outfitId ? { id: outfitId, timesWorn: 0 } : null);
      } else {
        await upsertWearLog(userId, date, chosen.map((i) => i.id), outfitId, true);
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
          <DialogTitle>{isToday ? "Pick today's outfit" : `Plan outfit for ${date}`}</DialogTitle>
          <DialogDescription>
            {isToday
              ? "Select the items you're wearing — they'll be logged and marked as worn."
              : "Select items to plan for that day. Nothing is marked worn until you confirm."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 min-w-[140px] flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={cleanOnly} onChange={(e) => setCleanOnly(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Wearable only
          </label>
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
                <button key={item.id} type="button" onClick={() => toggle(item)} className={cn("relative overflow-hidden rounded-xl border text-left transition", on ? "ring-2 ring-primary" : "hover:border-primary/40")}>
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

        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveAsOutfit} onChange={(e) => setSaveAsOutfit(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Save this combination as an outfit
          </label>
          {saveAsOutfit && (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label htmlFor="wp-name" className="text-xs">Outfit name</Label>
                <Input id="wp-name" value={outfitName} onChange={(e) => setOutfitName(e.target.value)} placeholder="e.g. University" className="h-8" />
              </div>
              <label className="flex items-center gap-1.5 pt-4 text-xs text-muted-foreground">
                <input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} className="h-4 w-4 rounded border-input" />
                Reusable template
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || selected.size === 0 || (saveAsOutfit && !outfitName.trim())}>
            {saving ? "Saving…" : isToday ? `Wear today (${selected.size})` : `Plan for ${date} (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
