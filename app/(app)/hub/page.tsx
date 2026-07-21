"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Zap, Bell, ChevronRight, Shirt, Sparkles, MapPin } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { loadHub, type HubLoad } from "@/lib/hub-data";
import {
  HUB_MODULES,
  defaultAgents,
  evaluateRule,
  renderRuleMessage,
  metricDef,
} from "@/lib/hub";
import { addHubNotification, updateAutomation } from "@/lib/firebase/db";
import { tgSend } from "@/lib/telegram";
import { surpriseOutfit, weatherSeason } from "@/lib/wardrobe";
import { formatLongDate } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HubAgent } from "@/lib/types";

export default function HubPage() {
  const { user } = useAuth();
  const [hub, setHub] = useState<HubLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const firedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setHub(await loadHub(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const data = hub?.data ?? null;
  const docs = hub?.docs ?? null;

  // Merged agent list: stored agents + built-in defaults for uncovered modules.
  const agents: HubAgent[] = useMemo(() => {
    if (!user) return [];
    const stored = docs?.agents ?? [];
    const covered = new Set(stored.map((a) => a.module));
    return [...stored, ...defaultAgents(user.uid).filter((d) => !covered.has(d.module))];
  }, [docs, user]);

  // Currently-true enabled rules → Needs Attention.
  const attention = useMemo(() => {
    if (!data || !docs) return [];
    return docs.automations
      .filter((a) => a.enabled)
      .map((a) => ({ rule: a, res: evaluateRule(a, data) }))
      .filter((x): x is { rule: (typeof docs.automations)[number]; res: { active: true; current: number } } => Boolean(x.res?.active))
      .map((x) => ({ rule: x.rule, message: renderRuleMessage(x.rule, x.res.current) }));
  }, [data, docs]);

  // Fire "notify" rules at most once per day (writes a notification + optional Telegram).
  useEffect(() => {
    if (!user || !data || !docs || firedRef.current) return;
    firedRef.current = true;
    const toFire = attention.filter(({ rule }) => rule.action === "notify" && rule.lastFired !== data.today);
    if (!toFire.length) return;
    void (async () => {
      for (const { rule, message } of toFire) {
        const def = metricDef(rule.metric);
        await addHubNotification(user.uid, {
          source: "automation",
          title: rule.name,
          body: message,
          href: def ? HUB_MODULES[def.module].href : null,
        });
        await updateAutomation(rule.id, { lastFired: data.today });
        const tg = hub?.prefs.telegram;
        if (rule.telegram && tg?.enabled && tg.botToken && tg.chatId) {
          void tgSend(tg.botToken, tg.chatId, `⚡ <b>${rule.name}</b>\n${message}`);
        }
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attention, user, data, docs]);

  // Today's outfit mini-card.
  const todayWear = data?.wears.find((w) => w.date === data.today) ?? null;
  const suggestion = useMemo(() => {
    if (!data || todayWear) return [];
    return surpriseOutfit(data.items, { season: data.weather ? weatherSeason(data.weather.temp) : null, preferFavorites: true });
  }, [data, todayWear]);
  const outfitItemsToday = useMemo(() => {
    if (!data) return [];
    if (todayWear) {
      const byId = new Map(data.items.map((i) => [i.id, i]));
      return todayWear.itemIds.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
    }
    return suggestion;
  }, [data, todayWear, suggestion]);

  const recentFired = useMemo(
    () => (docs?.automations ?? []).filter((a) => a.lastFired).sort((a, b) => (a.lastFired! < b.lastFired! ? 1 : -1)).slice(0, 5),
    [docs]
  );
  const unread = useMemo(() => (docs?.notifications ?? []).filter((n) => !n.read).length, [docs]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Bot className="h-6 w-6 text-primary" /> Agent Hub</h1>
          <p className="text-muted-foreground">{formatLongDate(data?.today ?? "")} — one glance, whole life.</p>
        </div>
        {data?.weather && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            🌤 {data.weather.temp}°C {data.weather.label} <MapPin className="h-3.5 w-3.5" /> Chișinău
            {data.weather.rainTomorrow && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-600 dark:text-sky-400">🌧 rain tomorrow</span>}
          </p>
        )}
      </div>

      {loading || !data || !docs ? (
        <div className="space-y-3"><SkeletonCard lines={4} /><SkeletonCard lines={6} /></div>
      ) : (
        <>
          {/* Needs attention */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">⚡ Needs attention {attention.length > 0 && `(${attention.length})`}</span>
              <Link href="/hub/automations" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">Rules <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {attention.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {docs.automations.length === 0 ? (
                  <>No rules yet — <Link href="/hub/automations" className="text-primary hover:underline">create your first automation</Link>.</>
                ) : (
                  "All clear — nothing needs your attention right now. ✨"
                )}
              </p>
            ) : (
              <div className="divide-y">
                {attention.map(({ rule, message }) => {
                  const def = metricDef(rule.metric);
                  const href = def ? HUB_MODULES[def.module].href : "/dashboard";
                  return (
                    <Link key={rule.id} href={href} className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-accent">
                      <span>{def ? HUB_MODULES[def.module].icon : "⚡"}</span>
                      <span className="min-w-0 flex-1 truncate">{message}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Today's outfit */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">👕 Today&apos;s outfit</span>
                <span className="text-xs text-muted-foreground">{todayWear ? (todayWear.planned ? "Planned" : "Worn") : "Suggested"}</span>
              </div>
              <div className="p-4">
                {outfitItemsToday.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nothing to suggest — add clothes or do laundry.</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {outfitItemsToday.map((i) => (
                      <div key={i.id} className="w-16">
                        <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/40">
                          {i.imageData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center"><Shirt className="h-5 w-5 text-muted-foreground/40" /></div>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[10px]">{i.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link href="/wardrobe"><Sparkles className="h-3.5 w-3.5" /> {todayWear ? "Open wardrobe" : "Confirm or shuffle"}</Link>
                </Button>
              </div>
            </Card>

            {/* Recent automations */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🔁 Recent automations</span>
                <Link href="/hub/notifications" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Bell className="h-3.5 w-3.5" /> {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{unread}</span>} Inbox
                </Link>
              </div>
              {recentFired.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No automations have fired yet.</p>
              ) : (
                <div className="divide-y">
                  {recentFired.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.lastFired}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Agents */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🤖 Agents</span>
              <Link href="/hub/agents" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">Open chat <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {agents.slice(0, 8).map((a) => (
                <Link key={a.id} href={`/hub/agents?id=${encodeURIComponent(a.id)}`} className="rounded-xl border p-3 transition hover:border-primary/40 hover:bg-accent">
                  <p className="text-2xl">{a.icon}</p>
                  <p className="mt-1 truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{HUB_MODULES[a.module].label}</p>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
