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
import { setWearForDay, createOutfit } from "@/lib/firebase/db";
import { categoriesInUse, filterItems, isWearable } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit, WearLog } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  items: ClothingItem[];
  /** Saved outfits offered as one-tap starting points. */
  outfits?: Outfit[];
  /** Date to assign (YYYY-MM-DD). Today = confirm; future = plan; past = log worn. */
  date: string;
  /** Pre-selected item ids (e.g. re-planning an existing day). */
  initialIds?: string[];
  /** The day's existing log, if any — used to reconcile wear counters (no double-count). */
  existing?: WearLog;
  /** When provided and a log already exists, shows a "Clear day" action. */
  onClear?: () => void;
  onSaved: () => void;
}

/** Pick items for a day — wear it now (today), plan it (future), or log it (past). */
export function WearPickerDialog({ open, onOpenChange, userId, items, outfits, date, initialIds, existing, onClear, onSaved }: Props) {
  const today = toDateKey(new Date());
  const kind: "confirm" | "plan" | "log" = date === today ? "confirm" : date > today ? "plan" : "log";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickedOutfitId, setPickedOutfitId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cleanOnly, setCleanOnly] = useState(true);
  const [saveAsOutfit, setSaveAsOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [asTemplate, setAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Only seed ids that still exist; drop retired ones too (except when logging a
    // past day, where an item worn back then may since have been retired).
    const seedable = new Set(items.filter((i) => kind === "log" || !i.retired).map((i) => i.id));
    setSelected(new Set((initialIds ?? []).filter((id) => seedable.has(id))));
    setPickedOutfitId(null);
    setQuery("");
    setCategory(null);
    setCleanOnly(true);
    setSaveAsOutfit(false);
    setOutfitName("");
    setAsTemplate(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIds]);

  const categories = useMemo(() => categoriesInUse(items), [items]);
  const visible = useMemo(() => {
    const base = filterItems(items, { query, category, includeRetired: false });
    return cleanOnly ? base.filter((i) => isWearable(i) || selected.has(i.id)) : base;
  }, [items, query, category, cleanOnly, selected]);

  function toggle(item: ClothingItem) {
    setPickedOutfitId(null); // manual changes make it an ad-hoc combination
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function startFromOutfit(o: Outfit) {
    const valid = new Set(items.filter((i) => !i.retired).map((i) => i.id));
    setSelected(new Set(o.itemIds.filter((id) => valid.has(id))));
    setPickedOutfitId(o.id);
    // Starting from a saved outfit means we're not creating a new one.
    setSaveAsOutfit(false);
    setOutfitName("");
    setAsTemplate(false);
  }

  // Count of selections that resolve to real items — drives the button and guards
  // against a stale selection writing an empty confirmed log.
  const chosenCount = useMemo(() => items.filter((i) => selected.has(i.id)).length, [items, selected]);

  async function save() {
    const chosen = items.filter((i) => selected.has(i.id));
    if (!userId || chosen.length === 0) return;
    setSaving(true);
    try {
      const picked = pickedOutfitId ? outfits?.find((o) => o.id === pickedOutfitId) ?? null : null;
      let outfit: Pick<Outfit, "id" | "timesWorn" | "lastWorn"> | null = picked
        ? { id: picked.id, timesWorn: picked.timesWorn, lastWorn: picked.lastWorn }
        : null;
      if (!picked && saveAsOutfit && outfitName.trim()) {
        const newId = await createOutfit(userId, {
          name: outfitName.trim(),
          type: asTemplate ? "template" : "custom",
          itemIds: chosen.map((i) => i.id),
          occasions: [],
          rating: null,
          weatherFit: null,
          notes: null,
          favorite: false,
        });
        outfit = { id: newId, timesWorn: 0, lastWorn: null };
      }

      // Only a previously CONFIRMED log has counters to reconcile against.
      const prevConfirmed = existing && !existing.planned ? existing : null;
      const byId = new Map(items.map((i) => [i.id, i]));
      const prevItems = prevConfirmed
        ? prevConfirmed.itemIds
            .map((id) => byId.get(id))
            .filter((i): i is ClothingItem => Boolean(i))
            .map((i) => ({ id: i.id, timesWorn: i.timesWorn }))
        : [];
      const prevOutfit =
        prevConfirmed?.outfitId != null
          ? (() => {
              const o = outfits?.find((x) => x.id === prevConfirmed.outfitId);
              return o ? { id: o.id, timesWorn: o.timesWorn } : null;
            })()
          : null;

      await setWearForDay({
        userId,
        date,
        kind,
        chosen: chosen.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
        outfit,
        prevItems,
        prevOutfit,
      });
      onOpenChange(false);
      onSaved();
    } catch {
      // A referenced item/outfit may have been deleted elsewhere — resync and tell the user.
      setError("Couldn't save — something changed. Please review and try again.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {kind === "confirm" ? "Pick today's outfit" : kind === "plan" ? `Plan outfit for ${date}` : `Log what you wore on ${date}`}
          </DialogTitle>
          <DialogDescription>
            {kind === "confirm"
              ? "Select the items you're wearing — they'll be logged and marked as worn."
              : kind === "plan"
                ? "Select items to plan for that day. Nothing is marked worn until you confirm."
                : "Record the outfit you wore that day. Wear counts update; current laundry status stays as-is."}
          </DialogDescription>
        </DialogHeader>

        {outfits && outfits.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start from an outfit</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {outfits.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => startFromOutfit(o)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
                    pickedOutfitId === o.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:bg-accent"
                  )}
                >
                  {o.type === "template" ? "★ " : ""}{o.name}
                </button>
              ))}
            </div>
          </div>
        )}

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

        <div className={cn("space-y-2 rounded-xl border bg-muted/20 p-3", pickedOutfitId && "hidden")}>
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

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <DialogFooter className="sm:justify-between">
          {onClear && existing ? (
            <Button
              type="button"
              variant="ghost"
              className="text-rose-600 hover:text-rose-600 dark:text-rose-400"
              onClick={() => {
                onClear();
                onOpenChange(false);
              }}
            >
              Clear day
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || chosenCount === 0 || (!pickedOutfitId && saveAsOutfit && !outfitName.trim())}>
            {saving
              ? "Saving…"
              : kind === "confirm"
                ? `Wear today (${chosenCount})`
                : kind === "plan"
                  ? `Plan for ${date} (${chosenCount})`
                  : `Log for ${date} (${chosenCount})`}
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
