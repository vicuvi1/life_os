"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Shirt,
  Plus,
  Check,
  Sparkles,
  MapPin,
  CalendarDays,
  WashingMachine,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWardrobe,
  updateClothing,
  confirmWear,
  type WardrobeData,
} from "@/lib/firebase/db";
import {
  STATUS_META,
  WARDROBE_STATUSES,
  statusCounts,
  categoriesInUse,
  filterItems,
  recentlyWorn,
  wearForDate,
} from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ItemCard } from "@/components/wardrobe/item-card";
import { ItemFormDialog } from "@/components/wardrobe/item-form-dialog";
import { WearPickerDialog } from "@/components/wardrobe/wear-picker-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem, WardrobeStatus } from "@/lib/types";

// --- Weather (display only — Chișinău by default; no recommendation logic) ---
const WEATHER_LAT = 47.01;
const WEATHER_LON = 28.86;
const WEATHER_PLACE = "Chișinău";

const WMO: { codes: number[]; label: string; icon: string }[] = [
  { codes: [0], label: "Clear", icon: "☀️" },
  { codes: [1, 2], label: "Partly cloudy", icon: "🌤️" },
  { codes: [3], label: "Overcast", icon: "☁️" },
  { codes: [45, 48], label: "Fog", icon: "🌫️" },
  { codes: [51, 53, 55, 56, 57], label: "Drizzle", icon: "🌦️" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: "Rain", icon: "🌧️" },
  { codes: [71, 73, 75, 77, 85, 86], label: "Snow", icon: "🌨️" },
  { codes: [95, 96, 99], label: "Thunderstorm", icon: "⛈️" },
];
function wmoMeta(code: number): { label: string; icon: string } {
  return WMO.find((w) => w.codes.includes(code)) ?? { label: "—", icon: "🌡️" };
}

/** "18-28" (with optional °C etc.) → does temp fall inside? Null if unparseable. */
function weatherFitMatches(fit: string | null, temp: number | null): boolean | null {
  if (!fit || temp == null) return null;
  const m = fit.match(/(-?\d+)\s*[-–]\s*(-?\d+)/);
  if (!m) return null;
  const lo = Math.min(Number(m[1]), Number(m[2]));
  const hi = Math.max(Number(m[1]), Number(m[2]));
  return temp >= lo && temp <= hi;
}

export default function WardrobeOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const today = toDateKey(new Date());

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

  useEffect(() => {
    // Best-effort current weather; the page works fine without it.
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code`)
      .then((r) => r.json())
      .then((j) => {
        const t = j?.current?.temperature_2m;
        const c = j?.current?.weather_code;
        if (typeof t === "number" && typeof c === "number") setWeather({ temp: Math.round(t), code: c });
      })
      .catch(() => {});
  }, []);

  const { items, outfits, wears } = data;
  const activeItems = useMemo(() => items.filter((i) => !i.retired), [items]);
  const counts = useMemo(() => statusCounts(items), [items]);
  const categories = useMemo(() => categoriesInUse(activeItems), [activeItems]);

  const gridItems = useMemo(
    () =>
      filterItems(items, {
        query,
        category,
        status: statusFilter === "all" ? null : (statusFilter as WardrobeStatus | "needsIroning"),
      }),
    [items, query, category, statusFilter]
  );

  const todayWear = useMemo(() => wearForDate(wears, today), [wears, today]);
  const todayItems = useMemo(() => {
    if (!todayWear) return [];
    const byId = new Map(items.map((i) => [i.id, i]));
    return todayWear.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => Boolean(i));
  }, [todayWear, items]);
  const todayOutfit = useMemo(
    () => (todayWear?.outfitId ? outfits.find((o) => o.id === todayWear.outfitId) ?? null : null),
    [todayWear, outfits]
  );
  const fitMatch = weatherFitMatches(todayOutfit?.weatherFit ?? null, weather?.temp ?? null);

  const recent = useMemo(() => recentlyWorn(items, 10), [items]);
  const upcoming = useMemo(() => {
    const days = [1, 2, 3].map((d) => addDays(today, d));
    return days.map((d) => ({ date: d, wear: wearForDate(wears, d) }));
  }, [wears, today]);

  function patchItem(item: ClothingItem, patch: Partial<ClothingItem>) {
    setData((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }));
    void updateClothing(item.id, patch).catch(() => void load({ quiet: true }));
  }

  async function confirmPlannedToday() {
    if (!user || !todayWear || todayItems.length === 0) return;
    await confirmWear(user.uid, today, todayItems, todayOutfit ? { id: todayOutfit.id, timesWorn: todayOutfit.timesWorn } : null);
    await load({ quiet: true });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Wardrobe</h1>
          <p className="text-muted-foreground">Your clothes, outfits, and laundry — decided in seconds.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/wardrobe/outfits"><Layers className="h-4 w-4" /> Outfits</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/wardrobe/laundry"><WashingMachine className="h-4 w-4" /> Laundry</Link>
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={8} />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Shirt className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Your wardrobe is empty</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Photograph your clothes once — then picking an outfit, tracking laundry, and knowing your cost-per-wear all take seconds.
          </p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add your first item
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          {/* Main column */}
          <div className="space-y-4">
            {/* Today's outfit hero */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s outfit</span>
                {todayOutfit && <span className="text-xs text-muted-foreground">{todayOutfit.name}</span>}
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
                <div>
                  {todayItems.length === 0 ? (
                    <div className="flex flex-col items-start gap-2 py-2">
                      <p className="text-sm text-muted-foreground">No outfit picked for today yet.</p>
                      <Button size="sm" onClick={() => setPickerOpen(true)}>
                        <Sparkles className="h-4 w-4" /> Pick today&apos;s outfit
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {todayItems.map((i) => (
                          <Link key={i.id} href={`/wardrobe/item/${i.id}`} className="w-20 shrink-0">
                            <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/40">
                              {i.imageData ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center"><Shirt className="h-6 w-6 text-muted-foreground/40" /></div>
                              )}
                            </div>
                            <p className="mt-1 truncate text-[11px] font-medium">{i.name}</p>
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[i.status].color }} />
                              {STATUS_META[i.status].label}
                            </p>
                          </Link>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {todayWear?.planned ? (
                          <Button size="sm" onClick={confirmPlannedToday}>
                            <Check className="h-4 w-4" /> Wear today
                          </Button>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Worn today
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Change</Button>
                      </div>
                    </>
                  )}
                </div>
                {/* Weather block */}
                <div className="flex min-w-[150px] flex-col items-center justify-center gap-1 rounded-xl border bg-muted/20 p-3 text-center">
                  {weather ? (
                    <>
                      <span className="text-3xl">{wmoMeta(weather.code).icon}</span>
                      <span className="text-xl font-bold tabular-nums">{weather.temp}°C</span>
                      <span className="text-xs text-muted-foreground">{wmoMeta(weather.code).label}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> {WEATHER_PLACE}</span>
                      {fitMatch === true && (
                        <span className="mt-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Perfect weather for this outfit
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Weather unavailable</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Quick templates — occasion shortcuts into Outfits */}
            {outfits.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <QuickShortcut href="/wardrobe/outfits?type=template" icon="★" label="Templates" count={outfits.filter((o) => o.type === "template").length} />
                <QuickShortcut href="/wardrobe/outfits" icon="❤️" label="Favorites" count={outfits.filter((o) => o.favorite).length} />
                {Array.from(new Set(outfits.flatMap((o) => o.occasions))).sort().map((occ) => (
                  <QuickShortcut
                    key={occ}
                    href={`/wardrobe/outfits?occasion=${encodeURIComponent(occ)}`}
                    icon="👔"
                    label={occ}
                    count={outfits.filter((o) => o.occasions.includes(occ)).length}
                  />
                ))}
              </div>
            )}

            {/* Wardrobe grid */}
            <Card className="overflow-hidden">
              <div className="space-y-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My wardrobe</span>
                  <span className="text-xs text-muted-foreground">· {gridItems.length} of {activeItems.length}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Input placeholder="Search name, brand, tag…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-[200px]" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {WARDROBE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                        <SelectItem value="needsIroning">Needs ironing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setCategory(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All</button>
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(category === c ? null : c)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category === c ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {gridItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches this filter.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {gridItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onStatusChange={(it, patch) => patchItem(it, patch)}
                        onToggleFavorite={(it) => patchItem(it, { favorite: !it.favorite })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Recently worn */}
            {recent.length > 0 && (
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recently worn</span>
                </div>
                <div className="flex gap-3 overflow-x-auto p-4">
                  {recent.map((i) => (
                    <Link key={i.id} href={`/wardrobe/item/${i.id}`} className="w-[76px] shrink-0">
                      <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/40">
                        {i.imageData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageData} alt={i.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Shirt className="h-6 w-6 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[11px] font-medium">{i.name}</p>
                      <p className="text-[10px] text-muted-foreground">{i.lastWorn}</p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4">
            <Card className="overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clothing status</span>
              </div>
              <div className="p-2">
                {WARDROBE_STATUSES.map((s) => (
                  <Link key={s} href={`/wardrobe/laundry?status=${s}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                    <span className="flex-1">{STATUS_META[s].label}</span>
                    <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </Link>
                ))}
                <Link href="/wardrobe/laundry?status=needsIroning" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                  <span>👔</span>
                  <span className="flex-1">Needs ironing</span>
                  <span className="tabular-nums text-muted-foreground">{counts.needsIroning}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </Link>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statistics</span>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <StatRow label="Items" value={String(activeItems.length)} />
                <StatRow label="Outfits" value={String(outfits.length)} />
                <StatRow
                  label="Most worn"
                  value={activeItems.length > 0 ? [...activeItems].sort((a, b) => b.timesWorn - a.timesWorn)[0]?.name ?? "—" : "—"}
                />
                <StatRow
                  label="Least worn"
                  value={activeItems.length > 0 ? [...activeItems].sort((a, b) => a.timesWorn - b.timesWorn)[0]?.name ?? "—" : "—"}
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> Upcoming outfits
                </span>
              </div>
              <div className="space-y-2 p-4">
                {upcoming.map(({ date, wear }) => (
                  <div key={date} className="flex items-center gap-2 text-sm">
                    <span className="w-[74px] shrink-0 text-xs tabular-nums text-muted-foreground">{date.slice(5)}</span>
                    {wear ? (
                      <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                        {wear.itemIds.slice(0, 4).map((id) => {
                          const it = items.find((x) => x.id === id);
                          return it?.imageData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={id} src={it.imageData} alt={it.name} className="h-7 w-7 rounded-md border object-cover" />
                          ) : (
                            <span key={id} className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40"><Shirt className="h-3.5 w-3.5 text-muted-foreground/50" /></span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="flex-1 text-xs text-muted-foreground/60">No outfit planned yet</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      )}

      {user && (
        <>
          <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} userId={user.uid} onSaved={load} />
          <WearPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            userId={user.uid}
            items={items}
            outfits={outfits}
            date={today}
            initialIds={todayWear?.itemIds}
            onSaved={() => load({ quiet: true })}
          />
        </>
      )}
    </div>
  );
}

function QuickShortcut({ href, icon, label, count }: { href: string; icon: string; label: string; count: number }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-accent">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
