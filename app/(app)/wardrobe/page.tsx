"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Shirt,
  Plus,
  Check,
  Sparkles,
  Shuffle,
  MapPin,
  CalendarDays,
  ChevronRight,
  Heart,
  History,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWardrobe,
  getBudget,
  updateClothing,
  setWearForDay,
  type WardrobeData,
} from "@/lib/firebase/db";
import { resolveCurrency, type Currency } from "@/lib/currency";
import {
  STATUS_META,
  WARDROBE_STATUSES,
  statusCounts,
  categoriesInUse,
  filterItems,
  recentlyWorn,
  wearForDate,
  seasonsInUse,
  currentSeason,
  weatherSuggestions,
  weatherSeason,
  surpriseOutfit,
  outfitItems,
  relativeDay,
  weekdayName,
  favoriteBrand,
  neverWorn,
  byWearCount,
  colorsInUse,
  colorSwatch,
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
import { ItemQuickView } from "@/components/wardrobe/item-quick-view";
import { WearPickerDialog } from "@/components/wardrobe/wear-picker-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit, WardrobeStatus } from "@/lib/types";

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

/** Placeholder slots shown in the hero before an outfit is picked. */
const OUTFIT_SLOTS = [
  { label: "Top", emoji: "👕" },
  { label: "Bottom", emoji: "👖" },
  { label: "Shoes", emoji: "👟" },
  { label: "Accessory", emoji: "⌚" },
];

/** "18-28°C" → does temp fall inside? Null if no genuine temperature range. */
function weatherFitMatches(fit: string | null, temp: number | null): boolean | null {
  if (!fit || temp == null) return null;
  // Only treat a number pair as a temperature range when it carries a degree
  // marker, or when it IS the whole field — so "gusts 15-25 km/h" never matches.
  const m = fit.match(/(-?\d+)\s*[-–]\s*(-?\d+)\s*°?\s*C\b/i) ?? fit.match(/^\s*(-?\d+)\s*[-–]\s*(-?\d+)\s*°?\s*$/);
  if (!m) return null;
  const lo = Math.min(Number(m[1]), Number(m[2]));
  const hi = Math.max(Number(m[1]), Number(m[2]));
  return temp >= lo && temp <= hi;
}

export default function WardrobeOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [forecast, setForecast] = useState<Record<string, { temp: number; code: number }>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [formItem, setFormItem] = useState<ClothingItem | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [suggestSeed, setSuggestSeed] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "favorites" | "recent">("all");
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  const today = toDateKey(new Date());

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [w, b] = await Promise.all([getWardrobe(user.uid), getBudget(user.uid)]);
      setData(w);
      setCurrency(resolveCurrency(b));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Best-effort current weather + 7-day forecast; the page works fine without it.
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&forecast_days=8&timezone=auto`
    )
      .then((r) => r.json())
      .then((j) => {
        const t = j?.current?.temperature_2m;
        const c = j?.current?.weather_code;
        if (typeof t === "number" && typeof c === "number") setWeather({ temp: Math.round(t), code: c });
        const days: string[] = j?.daily?.time ?? [];
        const codes: number[] = j?.daily?.weather_code ?? [];
        const highs: number[] = j?.daily?.temperature_2m_max ?? [];
        const map: Record<string, { temp: number; code: number }> = {};
        days.forEach((d, i) => {
          if (typeof highs[i] === "number" && typeof codes[i] === "number") {
            map[d] = { temp: Math.round(highs[i]), code: codes[i] };
          }
        });
        if (Object.keys(map).length) setForecast(map);
      })
      .catch(() => {});
  }, []);

  const { items, outfits, wears } = data;
  const activeItems = useMemo(() => items.filter((i) => !i.retired), [items]);
  const counts = useMemo(() => statusCounts(items), [items]);
  const categories = useMemo(() => categoriesInUse(activeItems), [activeItems]);
  const seasons = useMemo(() => seasonsInUse(activeItems), [activeItems]);
  const colors = useMemo(() => colorsInUse(activeItems), [activeItems]);

  const resolvedSeason = seasonFilter === "all" ? null : seasonFilter === "in" ? currentSeason() : seasonFilter;
  const gridItems = useMemo(() => {
    let list =
      statusFilter === "retired"
        ? filterItems(items, { query, category, season: resolvedSeason, includeRetired: true }).filter((i) => i.retired)
        : filterItems(items, {
            query,
            category,
            status: statusFilter === "all" ? null : (statusFilter as WardrobeStatus | "needsIroning"),
            season: resolvedSeason,
          });
    if (quickFilter === "favorites") list = list.filter((i) => i.favorite);
    else if (quickFilter === "recent") {
      const cutoff = addDays(today, -7);
      list = list
        .filter((i) => i.lastWorn && i.lastWorn >= cutoff)
        .sort((a, b) => (a.lastWorn! < b.lastWorn! ? 1 : -1));
    }
    if (colorFilter) list = list.filter((i) => (i.color ?? "").trim().toLowerCase() === colorFilter.toLowerCase());
    return list;
  }, [items, query, category, statusFilter, resolvedSeason, quickFilter, colorFilter, today]);

  // Richer statistics for the sidebar.
  const mostWorn = useMemo(() => byWearCount(items, "most").find((i) => i.timesWorn > 0) ?? null, [items]);
  const leastWorn = useMemo(() => byWearCount(items, "least").find((i) => i.timesWorn > 0) ?? null, [items]);
  const unusedCount = useMemo(() => neverWorn(items).length, [items]);
  const topBrand = useMemo(() => favoriteBrand(items), [items]);

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
  const suggest = weather ? weatherSuggestions(weather.temp) : null;

  // Weather-aware "suggested for today" outfit, shown when nothing is picked yet.
  const recentIds = useMemo(() => {
    const cutoff = addDays(today, -3);
    return new Set(items.filter((i) => i.lastWorn && i.lastWorn >= cutoff).map((i) => i.id));
  }, [items, today]);
  const suggestion = useMemo(
    () =>
      surpriseOutfit(items, {
        season: weather ? weatherSeason(weather.temp) : null,
        avoidIds: recentIds,
        preferFavorites: true,
      }),
    // suggestSeed re-rolls the suggestion on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, weather?.temp, recentIds, suggestSeed]
  );

  const recent = useMemo(() => recentlyWorn(items, 10), [items]);
  const upcoming = useMemo(() => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => addDays(today, d));
    return days.map((d) => ({ date: d, wear: wearForDate(wears, d) }));
  }, [wears, today]);

  // Saved outfits that suit today's weather (by season or a matching weather-fit range).
  const weatherOutfits = useMemo(() => {
    if (!weather) return [];
    const season = weatherSeason(weather.temp);
    return outfits
      .filter((o) => weatherFitMatches(o.weatherFit, weather.temp) === true || o.seasons.includes(season))
      .slice(0, 3);
  }, [outfits, weather]);

  function patchItem(item: ClothingItem, patch: Partial<ClothingItem>) {
    setData((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }));
    void updateClothing(item.id, patch).catch(() => void load({ quiet: true }));
  }

  function openPicker(date: string) {
    setPickerDate(date);
    setPickerOpen(true);
  }

  const activePickerDate = pickerDate ?? today;
  const activePickerWear = useMemo(() => wearForDate(wears, activePickerDate), [wears, activePickerDate]);
  const quickViewItem = useMemo(() => items.find((i) => i.id === quickViewId) ?? null, [items, quickViewId]);

  async function wearSuggestion() {
    if (!user || suggestion.length === 0) return;
    try {
      await setWearForDay({
        userId: user.uid,
        date: today,
        kind: "confirm",
        chosen: suggestion.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
        outfit: null,
        prevItems: [],
        prevOutfit: null,
      });
    } finally {
      await load({ quiet: true });
    }
  }

  async function wearOutfitToday(o: Outfit) {
    if (!user) return;
    const wearItems = outfitItems(o, items).filter((i) => !i.retired);
    if (wearItems.length === 0) return;
    const prevConfirmed = todayWear && !todayWear.planned ? todayWear : null;
    const byId = new Map(items.map((i) => [i.id, i]));
    const prevItems = prevConfirmed
      ? prevConfirmed.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => Boolean(i)).map((i) => ({ id: i.id, timesWorn: i.timesWorn }))
      : [];
    const prevOutfit = prevConfirmed?.outfitId
      ? (() => { const p = outfits.find((x) => x.id === prevConfirmed.outfitId); return p ? { id: p.id, timesWorn: p.timesWorn } : null; })()
      : null;
    try {
      await setWearForDay({
        userId: user.uid,
        date: today,
        kind: "confirm",
        chosen: wearItems.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
        outfit: { id: o.id, timesWorn: o.timesWorn, lastWorn: o.lastWorn },
        prevItems,
        prevOutfit,
      });
    } finally {
      await load({ quiet: true });
    }
  }

  async function confirmPlannedToday() {
    if (!user || !todayWear || todayItems.length === 0) return;
    try {
      // The day was planned (no counters applied yet) → nothing to reconcile.
      await setWearForDay({
        userId: user.uid,
        date: today,
        kind: "confirm",
        chosen: todayItems.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
        outfit: todayOutfit ? { id: todayOutfit.id, timesWorn: todayOutfit.timesWorn, lastWorn: todayOutfit.lastWorn } : null,
        prevItems: [],
        prevOutfit: null,
      });
    } finally {
      await load({ quiet: true });
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Wardrobe</h1>
          <p className="text-muted-foreground">Your clothes, outfits, and laundry — decided in seconds.</p>
        </div>
        <Button onClick={() => { setFormItem(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add item
        </Button>
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
          <Button onClick={() => { setFormItem(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add your first item
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          {/* Main column */}
          <div className="space-y-4">
            {/* Today's outfit hero */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s outfit</span>
                {todayOutfit && <span className="text-sm font-medium text-muted-foreground">{todayOutfit.name}</span>}
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_230px]">
                <div className="space-y-4">
                  {!todayWear ? (
                    suggestion.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Suggested for today{weather ? ` · ${weatherSeason(weather.temp).toLowerCase()} pick` : ""}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {suggestion.map((i) => (
                            <div key={i.id} className="w-24">
                              <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-muted/40">
                                {i.imageData ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center"><Shirt className="h-7 w-7 text-muted-foreground/40" /></div>
                                )}
                              </div>
                              <p className="mt-1.5 truncate text-xs font-medium">{i.name}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{i.category ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={wearSuggestion}>
                            <Check className="h-4 w-4" /> Wear this
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSuggestSeed((s) => s + 1)}>
                            <Shuffle className="h-4 w-4" /> Shuffle
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openPicker(today)}>Pick manually</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-3">
                          {OUTFIT_SLOTS.map((slot) => (
                            <div key={slot.label} className="flex flex-col items-center gap-1.5">
                              <div className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 text-4xl">
                                <span className="opacity-30">{slot.emoji}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground">{slot.label}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activeItems.length === 0 ? "Add clothes to get outfit suggestions." : "Nothing clean to suggest right now — check your laundry."}
                        </p>
                        <Button onClick={() => openPicker(today)}>
                          <Shirt className="h-4 w-4" /> Pick today&apos;s outfit
                        </Button>
                      </>
                    )
                  ) : todayItems.length === 0 ? (
                    <div className="flex flex-col items-start gap-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {todayWear.planned ? "Planned for today" : "Logged as worn today"} — but those items are no longer in your wardrobe.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!todayWear.planned && (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Worn today
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openPicker(today)}>Change</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {todayItems.map((i) => (
                          <Link key={i.id} href={`/wardrobe/item/${i.id}`} className="group w-24 shrink-0">
                            <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-muted/40 transition group-hover:border-primary/40">
                              {i.imageData ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center"><Shirt className="h-7 w-7 text-muted-foreground/40" /></div>
                              )}
                            </div>
                            <p className="mt-1.5 truncate text-xs font-medium">{i.name}</p>
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[i.status].color }} />
                              {STATUS_META[i.status].label}
                            </p>
                          </Link>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {todayWear?.planned ? (
                          <Button size="sm" onClick={confirmPlannedToday}>
                            <Check className="h-4 w-4" /> Wear today
                          </Button>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Worn today
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openPicker(today)}>Change</Button>
                      </div>
                    </>
                  )}
                </div>
                {/* Weather + what-to-wear */}
                <div className="flex flex-col gap-2 rounded-2xl border bg-muted/20 p-4">
                  {weather && suggest ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{wmoMeta(weather.code).icon}</span>
                        <div>
                          <p className="text-2xl font-bold leading-none tabular-nums">{weather.temp}°C</p>
                          <p className="text-xs text-muted-foreground">{wmoMeta(weather.code).label}</p>
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> {WEATHER_PLACE}</p>
                        </div>
                      </div>
                      {fitMatch === true && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Perfect weather for this outfit
                        </span>
                      )}
                      <div className="mt-1 space-y-1 border-t pt-2 text-xs">
                        <p className="font-medium text-muted-foreground">Good for today</p>
                        {suggest.wear.map((w) => (
                          <p key={w} className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> {w}</p>
                        ))}
                        {suggest.avoid.map((w) => (
                          <p key={w} className="flex items-center gap-1.5 text-muted-foreground"><span className="font-semibold text-rose-500">✗</span> {w}</p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Weather unavailable</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Saved outfits that suit today's weather */}
            {weatherOutfits.length > 0 && (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outfits for today&apos;s weather</span>
                  {weather && <span className="text-xs text-muted-foreground">{weather.temp}°C · {weatherSeason(weather.temp).toLowerCase()}</span>}
                </div>
                <div className="flex gap-3 overflow-x-auto p-4">
                  {weatherOutfits.map((o) => {
                    const its = outfitItems(o, items).filter((i) => !i.retired);
                    return (
                      <div key={o.id} className="w-44 shrink-0 rounded-xl border p-2.5">
                        <div className="flex items-center gap-1">
                          {its.slice(0, 4).map((i) => (
                            <span key={i.id} className="h-9 w-9 overflow-hidden rounded-md border bg-muted/40">
                              {i.imageData ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center"><Shirt className="h-4 w-4 text-muted-foreground/40" /></span>
                              )}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 truncate text-sm font-medium">{o.name}</p>
                        <p className="mb-2 truncate text-[11px] text-muted-foreground">{o.occasions.join(" · ") || `${its.length} items`}</p>
                        <Button size="sm" variant="outline" className="w-full" disabled={its.length === 0} onClick={() => wearOutfitToday(o)}>
                          <Check className="h-3.5 w-3.5" /> Wear today
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Quick templates — occasion shortcuts into Outfits */}
            {outfits.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <QuickShortcut href="/wardrobe/outfits?type=template" icon="★" label="Templates" count={outfits.filter((o) => o.type === "template").length} />
                <QuickShortcut href="/wardrobe/outfits?type=favorites" icon="❤️" label="Favorites" count={outfits.filter((o) => o.favorite).length} />
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
                    <Input placeholder="Search wardrobe…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-[180px]" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {WARDROBE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                        <SelectItem value="needsIroning">Needs ironing</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    {seasons.length > 0 && (
                      <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All seasons</SelectItem>
                          <SelectItem value="in">In season ({currentSeason()})</SelectItem>
                          {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setQuickFilter("all")} className={cn("flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", quickFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All</button>
                  <button type="button" onClick={() => setQuickFilter((q) => (q === "favorites" ? "all" : "favorites"))} className={cn("flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", quickFilter === "favorites" ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}><Heart className="h-3 w-3" /> Favorites</button>
                  <button type="button" onClick={() => setQuickFilter((q) => (q === "recent" ? "all" : "recent"))} className={cn("flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", quickFilter === "recent" ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}><History className="h-3 w-3" /> Recently worn</button>
                  {categories.length > 0 && <span className="mx-0.5 h-4 w-px bg-border" />}
                  <button type="button" onClick={() => setCategory(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All types</button>
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(category === c ? null : c)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category === c ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{c}</button>
                  ))}
                </div>
                {colors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Colour</span>
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        aria-label={`Filter by ${c}`}
                        onClick={() => setColorFilter(colorFilter === c ? null : c)}
                        className={cn(
                          "h-5 w-5 rounded-full border border-black/10 transition dark:border-white/20",
                          colorFilter === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:scale-110"
                        )}
                        style={{ backgroundColor: colorSwatch(c) ?? "#999" }}
                      />
                    ))}
                    {colorFilter && (
                      <button type="button" onClick={() => setColorFilter(null)} className="text-[11px] text-muted-foreground underline hover:text-foreground">clear</button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4">
                {gridItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches this filter.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {gridItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onQuickView={(it) => setQuickViewId(it.id)}
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
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wardrobe health</span>
                <span className="rounded-full bg-secondary px-2 text-xs font-medium tabular-nums text-muted-foreground">{activeItems.length} items</span>
              </div>
              <div className="p-2">
                {WARDROBE_STATUSES.filter((s) => counts[s] > 0).map((s) => (
                  <Link key={s} href={`/wardrobe/laundry?status=${s}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                    <span className="flex-1">{STATUS_META[s].label}</span>
                    <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </Link>
                ))}
                {counts.needsIroning > 0 && (
                  <Link href="/wardrobe/laundry?status=needsIroning" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                    <span>👔</span>
                    <span className="flex-1">Needs ironing</span>
                    <span className="tabular-nums text-muted-foreground">{counts.needsIroning}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </Link>
                )}
                {unusedCount > 0 && (
                  <Link href="/wardrobe/stats" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent">
                    <span>🕳️</span>
                    <span className="flex-1">Never worn</span>
                    <span className="tabular-nums text-muted-foreground">{unusedCount}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </Link>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statistics</span>
                <Link href="/wardrobe/stats" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                  Details <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y">
                <StatRow label="Most worn" name={mostWorn?.name ?? "—"} sub={mostWorn ? `${mostWorn.timesWorn} wears` : undefined} />
                <StatRow label="Least worn" name={leastWorn?.name ?? "—"} sub={leastWorn ? `${leastWorn.timesWorn} wears` : undefined} />
                <StatRow label="Never worn" name={`${unusedCount} ${unusedCount === 1 ? "item" : "items"}`} />
                {topBrand && topBrand.count >= 2 && (
                  <StatRow label="Favorite brand" name={topBrand.brand} sub={`${topBrand.count} pieces`} />
                )}
                <StatRow label="Outfits saved" name={String(outfits.length)} />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> 7-day planner
                </span>
              </div>
              <div className="space-y-1 p-2">
                {upcoming.map(({ date, wear }) => {
                  const outfit = wear?.outfitId ? outfits.find((o) => o.id === wear.outfitId) ?? null : null;
                  const label = relativeDay(date, today) ?? weekdayName(date);
                  const fc = forecast[date];
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => openPicker(date)}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-accent"
                    >
                      <div className="w-[78px] shrink-0">
                        <p className="text-xs font-medium">{label}</p>
                        <p className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                          {date.slice(5)}
                          {fc && <span>· {wmoMeta(fc.code).icon} {fc.temp}°</span>}
                        </p>
                      </div>
                      {wear ? (
                        <div className="min-w-0 flex-1 space-y-1">
                          {(outfit || wear.itemIds.length > 0) && (
                            <p className="truncate text-xs font-medium">
                              {outfit?.name ?? `${wear.itemIds.length} item${wear.itemIds.length === 1 ? "" : "s"}`}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            {wear.itemIds.slice(0, 4).map((id) => {
                              const it = items.find((x) => x.id === id);
                              return it?.imageData ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={id} src={it.imageData} alt={it.name} className="h-8 w-8 rounded-md border object-cover" />
                              ) : (
                                <span key={id} className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/40"><Shirt className="h-3.5 w-3.5 text-muted-foreground/50" /></span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="flex-1 self-center text-xs text-muted-foreground/60">Tap to plan an outfit</span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/40" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </aside>
        </div>
      )}

      {user && (
        <>
          <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} userId={user.uid} item={formItem} onSaved={() => load({ quiet: true })} />
          <ItemQuickView
            open={quickViewId !== null}
            onOpenChange={(o) => !o && setQuickViewId(null)}
            item={quickViewItem}
            outfits={outfits}
            currency={currency}
            onPatch={(it, patch) => patchItem(it, patch)}
            onEdit={(it) => { setQuickViewId(null); setFormItem(it); setFormOpen(true); }}
          />
          <WearPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            userId={user.uid}
            items={items}
            outfits={outfits}
            date={activePickerDate}
            initialIds={activePickerWear?.itemIds}
            existing={activePickerWear}
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

function StatRow({ label, name, sub }: { label: string; name: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-col items-end text-right">
        <span className="min-w-0 max-w-full truncate font-medium">{name}</span>
        {sub && <span className="text-[11px] tabular-nums text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
