"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Shirt,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getWardrobe, getBudget, type WardrobeData } from "@/lib/firebase/db";
import {
  byWearCount,
  costPerWearRanking,
  neverWorn,
  wardrobeValue,
  categoryBreakdown,
  categoryGaps,
  occasionGaps,
  wearDaysInMonth,
} from "@/lib/wardrobe";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { toDateKey } from "@/lib/greeting";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClothingItem } from "@/lib/types";

export default function WardrobeStatsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [w, b] = await Promise.all([getWardrobe(user.uid), getBudget(user.uid)]);
      setData(w);
      setCurrency(resolveCurrency(b));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const { items, outfits, wears } = data;
  const active = useMemo(() => items.filter((i) => !i.retired), [items]);

  const mostWorn = useMemo(() => byWearCount(items, "most").filter((i) => i.timesWorn > 0).slice(0, 6), [items]);
  const cpw = useMemo(() => costPerWearRanking(items), [items]);
  const bestValue = useMemo(() => cpw.slice(0, 6), [cpw]);
  const worstValue = useMemo(() => [...cpw].reverse().slice(0, 6), [cpw]);
  const never = useMemo(() => neverWorn(items), [items]);
  const value = useMemo(() => wardrobeValue(items), [items]);
  const totalWears = useMemo(() => active.reduce((s, i) => s + i.timesWorn, 0), [active]);
  const pricedCount = useMemo(() => active.filter((i) => i.cost != null && i.cost > 0).length, [active]);
  const avgCostPerItem = pricedCount > 0 ? value / pricedCount : null;
  const avgCostPerWear = totalWears > 0 && value > 0 ? value / totalWears : null;
  // The single most actionable nudge, in priority order.
  const recommendation = useMemo(() => {
    if (never.length > 0) {
      return `${never.length} item${never.length === 1 ? " has" : "s have"} never been worn — style ${never.length === 1 ? "it" : "them"} or let ${never.length === 1 ? "it" : "them"} go.`;
    }
    const worst = cpw.length > 0 ? cpw[cpw.length - 1] : null;
    if (worst && worst.cpw >= 20 && currency) {
      return `"${worst.item.name}" costs ${formatAmount(worst.cpw, currency)}/wear — your priciest per wear. Wear it more, or consider letting it go.`;
    }
    return null;
  }, [never, cpw, currency]);
  const breakdown = useMemo(() => categoryBreakdown(items), [items]);
  const catGaps = useMemo(() => categoryGaps(items), [items]);
  const occGaps = useMemo(() => occasionGaps(outfits), [outfits]);

  const trend = useMemo(() => {
    const now = new Date();
    const thisYm = toDateKey(now).slice(0, 7);
    const lastYm = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    const thisCount = wearDaysInMonth(wears, thisYm);
    const lastCount = wearDaysInMonth(wears, lastYm);
    return { thisCount, lastCount, hasHistory: lastCount > 0 };
  }, [wears]);

  const maxCat = breakdown.length > 0 ? breakdown[0].count : 0;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Statistics</h1>
        <p className="text-muted-foreground">What you actually wear — and what&apos;s just taking up space.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={8} />
        </div>
      ) : active.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Shirt className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No stats yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add clothes and start logging what you wear — cost-per-wear, most-worn, and wardrobe gaps all appear here.
          </p>
          <Button asChild><Link href="/wardrobe"><ArrowRight className="h-4 w-4" /> Go to wardrobe</Link></Button>
        </Card>
      ) : (
        <>
          {recommendation && (
            <Card className="flex items-start gap-2 border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <span>💡</span>
              <p>{recommendation}</p>
            </Card>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Items" value={String(active.length)} hint={`${outfits.length} saved outfits`} />
            <Kpi
              label="Total invested"
              value={value > 0 && currency ? formatAmount(value, currency) : "—"}
              hint={avgCostPerItem && currency ? `${formatAmount(avgCostPerItem, currency)} avg / item` : value > 0 ? "Sum of item prices" : "Add prices to items"}
            />
            <Kpi
              label="Total wears"
              value={String(totalWears)}
              hint={avgCostPerWear && currency ? `${formatAmount(avgCostPerWear, currency)} avg / wear` : "Across all items"}
            />
            <Kpi
              label="Worn this month"
              value={`${trend.thisCount} ${trend.thisCount === 1 ? "day" : "days"}`}
              hint={trend.hasHistory ? undefined : "Log outfits to see a trend"}
              trend={trend.hasHistory ? trend.thisCount - trend.lastCount : null}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankCard
              title="Most worn"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              empty="Nothing worn yet."
              rows={mostWorn.map((i) => ({ item: i, right: `${i.timesWorn}×` }))}
            />
            <RankCard
              title="Best value"
              subtitle="Lowest cost-per-wear"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              empty="Add prices + wear items to rank value."
              rows={bestValue.map((e) => ({
                item: e.item,
                right: currency ? `${formatAmount(e.cpw, currency)}/wear` : `${e.cpw}`,
              }))}
            />
            <RankCard
              title="Costly & underused"
              subtitle="Highest cost-per-wear"
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              empty="Add prices + wear items to rank value."
              rows={worstValue.map((e) => ({
                item: e.item,
                right: currency ? `${formatAmount(e.cpw, currency)}/wear` : `${e.cpw}`,
                warn: true,
              }))}
            />
            <RankCard
              title="Never worn"
              subtitle={never.length > 0 ? `${never.length} item${never.length === 1 ? "" : "s"} waiting` : undefined}
              icon={<Shirt className="h-3.5 w-3.5" />}
              empty="Everything's been worn at least once. 👏"
              rows={never.slice(0, 6).map((i) => ({ item: i, right: "0×", warn: true }))}
            />
          </div>

          {/* Category breakdown */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By category</span>
            </div>
            <div className="space-y-2.5 p-4">
              {breakdown.map(({ category, count }) => (
                <div key={category} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate">{category}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${maxCat ? (count / maxCat) * 100 : 0}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Gap analysis */}
          {(catGaps.length > 0 || occGaps.length > 0) && (
            <Card className="overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wardrobe gaps</span>
              </div>
              <div className="space-y-3 p-4 text-sm">
                {catGaps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">No items in:</span>
                    {catGaps.map((c) => (
                      <span key={c} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground">{c}</span>
                    ))}
                  </div>
                )}
                {occGaps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">No outfit saved for:</span>
                    {occGaps.map((o) => (
                      <Link
                        key={o}
                        href={`/wardrobe/outfits?occasion=${encodeURIComponent(o)}`}
                        className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground transition hover:border-solid hover:text-foreground"
                      >
                        {o}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, trend }: { label: string; value: string; hint?: string; trend?: number | null }) {
  const up = typeof trend === "number" && trend > 0;
  const down = typeof trend === "number" && trend < 0;
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {typeof trend === "number" ? (
        <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : null}
          {up ? "+" : ""}{trend} vs last month
        </p>
      ) : hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}

interface Row {
  item: ClothingItem;
  right: string;
  warn?: boolean;
}
function RankCard({
  title,
  subtitle,
  icon,
  rows,
  empty,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  rows: Row[];
  empty: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icon} {title}
        </span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="p-2">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          rows.map(({ item, right, warn }) => (
            <Link
              key={item.id}
              href={`/wardrobe/item/${item.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-accent"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                {item.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageData} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Shirt className="h-4 w-4 text-muted-foreground/40" /></div>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{right}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
