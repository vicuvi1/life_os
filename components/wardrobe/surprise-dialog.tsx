"use client";

import { useEffect, useMemo, useState } from "react";
import { Shirt, Shuffle, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setWearForDay } from "@/lib/firebase/db";
import { surpriseOutfit, isWearable, seasonsInUse, currentSeason, STATUS_META } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit, WearLog } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  items: ClothingItem[];
  outfits: Outfit[];
  /** Today's existing wear log, so wearing the pick reconciles counters. */
  existingToday?: WearLog;
  onSaved: () => void;
}

/** "Surprise me" — assemble a random wearable outfit you can wear in one tap. */
export function SurpriseDialog({ open, onOpenChange, userId, items, outfits, existingToday, onSaved }: Props) {
  const today = toDateKey(new Date());
  const seasons = useMemo(() => seasonsInUse(items), [items]);
  const [season, setSeason] = useState<string | null>(null);
  const [combo, setCombo] = useState<ClothingItem[]>([]);
  const [seed, setSeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wearableCount = useMemo(() => items.filter(isWearable).length, [items]);

  // Re-roll whenever the dialog opens, the season changes, or Shuffle is hit.
  useEffect(() => {
    if (!open) return;
    setCombo(surpriseOutfit(items, { season }));
  }, [open, season, seed, items]);

  useEffect(() => {
    if (open) {
      setSeason(null);
      setError(null);
    }
  }, [open]);

  async function wearIt() {
    if (!userId || combo.length === 0) return;
    setSaving(true);
    try {
      const prevConfirmed = existingToday && !existingToday.planned ? existingToday : null;
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
              const o = outfits.find((x) => x.id === prevConfirmed.outfitId);
              return o ? { id: o.id, timesWorn: o.timesWorn } : null;
            })()
          : null;
      await setWearForDay({
        userId,
        date: today,
        kind: "confirm",
        chosen: combo.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
        outfit: null,
        prevItems,
        prevOutfit,
      });
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save — please shuffle and try again.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Surprise me</DialogTitle>
          <DialogDescription>A random wearable outfit from clean & ready clothes. Not feeling it? Shuffle again.</DialogDescription>
        </DialogHeader>

        {seasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSeason(null)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", season == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}
            >
              Any season
            </button>
            <button
              type="button"
              onClick={() => setSeason(currentSeason())}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", season === currentSeason() ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}
            >
              In season ({currentSeason()})
            </button>
            {seasons.filter((s) => s !== currentSeason()).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s)}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", season === s ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {wearableCount === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No wearable items right now — everything is in the wash. Do some laundry first!
          </p>
        ) : combo.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing wearable matches this season.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3 py-2">
            {combo.map((i) => (
              <div key={i.id} className="w-24">
                <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/40">
                  {i.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Shirt className="h-7 w-7 text-muted-foreground/40" /></div>
                  )}
                </div>
                <p className="mt-1 truncate text-center text-[11px] font-medium">{i.name}</p>
                <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[i.status].color }} />
                  {i.category ?? STATUS_META[i.status].label}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setSeed((s) => s + 1)} disabled={combo.length === 0}>
            <Shuffle className="h-4 w-4" /> Shuffle
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" onClick={wearIt} disabled={saving || combo.length === 0}>
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Wear it today"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
