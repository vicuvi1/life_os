"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Shirt,
  BarChart3,
  Layers,
  Check,
  Clock,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getWardrobe, removeWearDay, type WardrobeData } from "@/lib/firebase/db";
import { monthGrid, WEEKDAY_LABELS, wearForDate } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WearPickerDialog } from "@/components/wardrobe/wear-picker-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem, WearLog } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function WardrobeCalendarPage() {
  const { user } = useAuth();
  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [loading, setLoading] = useState(true);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const today = toDateKey(now);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      setData(await getWardrobe(user.uid));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const { items, outfits, wears } = data;
  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
  const monthStats = useMemo(() => {
    const inMonth = wears.filter((w) => w.date.startsWith(monthPrefix));
    return {
      worn: inMonth.filter((w) => !w.planned).length,
      planned: inMonth.filter((w) => w.planned).length,
    };
  }, [wears, monthPrefix]);

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const existing = pickerDate ? wearForDate(wears, pickerDate) : undefined;

  async function clearDay(date: string) {
    if (!user) return;
    const wear = wearForDate(wears, date);
    if (!wear) return;
    const confirmed = !wear.planned;
    const prevItems = confirmed
      ? wear.itemIds
          .map((id) => itemsById.get(id))
          .filter((i): i is ClothingItem => Boolean(i))
          .map((i) => ({ id: i.id, timesWorn: i.timesWorn }))
      : [];
    const prevOutfit =
      confirmed && wear.outfitId
        ? (() => {
            const o = outfits.find((x) => x.id === wear.outfitId);
            return o ? { id: o.id, timesWorn: o.timesWorn } : null;
          })()
        : null;
    await removeWearDay({ userId: user.uid, date, prevItems, prevOutfit });
    await load({ quiet: true });
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/wardrobe" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Wardrobe
          </Link>
          <h1 className="text-2xl font-bold md:text-3xl">Outfit calendar</h1>
          <p className="text-muted-foreground">Plan ahead, and look back at what you wore.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/wardrobe/stats"><BarChart3 className="h-4 w-4" /> Statistics</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/wardrobe/outfits"><Layers className="h-4 w-4" /> Outfits</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCard lines={10} />
      ) : (
        <Card className="overflow-hidden">
          {/* Month header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] text-center text-sm font-semibold">{MONTHS[view.month]} {view.year}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-8"
                onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}
              >
                Today
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Worn {monthStats.worn}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Planned {monthStats.planned}</span>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 border-b bg-muted/10 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const wear = wearForDate(wears, cell.date);
              const isToday = cell.date === today;
              const thumbs = wear
                ? wear.itemIds.map((id) => itemsById.get(id)).filter((i): i is ClothingItem => Boolean(i)).slice(0, 3)
                : [];
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setPickerDate(cell.date)}
                  className={cn(
                    "group relative flex min-h-[76px] flex-col gap-1 border-b border-r p-1.5 text-left transition last:border-r-0 hover:bg-accent",
                    !cell.inMonth && "bg-muted/20 text-muted-foreground/50",
                    isToday && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                  {wear && (
                    <div className="flex items-center gap-0.5">
                      {thumbs.map((it) => (
                        <span key={it.id} className="h-6 w-6 overflow-hidden rounded-md border bg-muted/40">
                          {it.imageData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.imageData} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center"><Shirt className="h-3 w-3 text-muted-foreground/40" /></span>
                          )}
                        </span>
                      ))}
                      {wear.itemIds.length > 3 && (
                        <span className="text-[10px] font-medium text-muted-foreground">+{wear.itemIds.length - 3}</span>
                      )}
                    </div>
                  )}
                  {wear && (
                    <span
                      className={cn(
                        "mt-auto flex items-center gap-1 text-[10px] font-medium",
                        wear.planned ? "text-sky-600 dark:text-sky-400" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {wear.planned ? <Clock className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                      {wear.planned ? "Planned" : "Worn"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Tap any day to plan a future outfit, log a past one, or confirm today&apos;s.
      </p>

      {user && pickerDate && (
        <WearPickerDialog
          open={pickerDate !== null}
          onOpenChange={(o) => !o && setPickerDate(null)}
          userId={user.uid}
          items={items}
          outfits={outfits}
          date={pickerDate}
          initialIds={existing?.itemIds}
          existing={existing}
          onClear={() => void clearDay(pickerDate)}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
}
