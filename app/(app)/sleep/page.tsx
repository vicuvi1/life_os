"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Moon,
  Sun,
  Plus,
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  Clock,
  Pencil,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSleepEntries, getPrefs, upsertPrefs } from "@/lib/firebase/db";
import { NumberField } from "@/components/ui/number-field";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate, formatMonthYear, monthGrid, isInMonth, dayNum, WEEKDAYS_SHORT } from "@/lib/dates";
import {
  formatHours,
  averageHours,
  sleepScore,
  scoreMeta,
  sleepGoalStreak,
  timeInBedHours,
  qualityRating,
} from "@/lib/sleep";
import { SleepLogDialog } from "@/components/sleep/sleep-log-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SleepKind, SleepLog } from "@/lib/types";

function weekdayShort(dateKey: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${dateKey}T00:00:00`).getDay()];
}

export default function SleepPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const now = useMemo(() => new Date(), []);

  const [entries, setEntries] = useState<SleepLog[]>([]);
  const [target, setTarget] = useState(8);
  const [bedtimeTarget, setBedtimeTarget] = useState<string>("");
  const [wakeTarget, setWakeTarget] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{ open: boolean; kind: SleepKind; date: string; entry: SleepLog | null }>({
    open: false,
    kind: "sleep",
    date: today,
    entry: null,
  });
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [search, setSearch] = useState("");

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [e, prefs] = await Promise.all([getSleepEntries(user.uid), getPrefs(user.uid)]);
      setEntries(e);
      setTarget(prefs.sleepTarget);
      setBedtimeTarget(prefs.bedtimeTarget ?? "");
      setWakeTarget(prefs.wakeTarget ?? "");
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const primary = useMemo(() => entries.filter((e) => e.kind !== "nap"), [entries]);
  const naps = useMemo(() => entries.filter((e) => e.kind === "nap"), [entries]);
  const primaryByDate = useMemo(() => new Map(primary.map((p) => [p.date, p])), [primary]);

  const heroLog = useMemo(() => primaryByDate.get(today) ?? primary[0] ?? null, [primaryByDate, primary, today]);
  const heroScore = heroLog ? sleepScore(heroLog, target) : 0;
  const heroMeta = scoreMeta(heroScore);

  const last7 = useMemo(
    () => [6, 5, 4, 3, 2, 1, 0].map((d) => addDays(today, -d)).map((date) => ({ date, log: primaryByDate.get(date) ?? null })),
    [primaryByDate, today]
  );
  const week7 = useMemo(() => last7.map((d) => d.log).filter((l): l is SleepLog => Boolean(l)), [last7]);
  const avgDuration = useMemo(() => averageHours(week7), [week7]);
  const avgScore = useMemo(
    () => (week7.length ? Math.round(week7.reduce((s, l) => s + sleepScore(l, target), 0) / week7.length) : 0),
    [week7, target]
  );
  const streak = useMemo(() => sleepGoalStreak(primary, target, today), [primary, target, today]);
  const maxBar = useMemo(() => Math.max(10, ...week7.map((l) => l.hours)), [week7]);

  const napsToday = useMemo(() => naps.filter((n) => n.date === today), [naps, today]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const list = q ? entries.filter((e) => e.date.includes(q)) : entries;
    return list.slice(0, 60);
  }, [entries, search]);

  function openLog(kind: SleepKind, date: string, entry: SleepLog | null) {
    setDialog({ open: true, kind, date, entry });
  }
  function openDay(date: string) {
    openLog("sleep", date, primaryByDate.get(date) ?? null);
  }

  function commitGoal(patch: { sleepTarget?: number; bedtimeTarget?: string | null; wakeTarget?: string | null }) {
    if (!user) return;
    void upsertPrefs(user.uid, patch);
  }

  const cells = useMemo(() => monthGrid(view.year, view.month).flat(), [view]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Moon className="h-6 w-6 text-indigo-400" /> Sleep
          </h1>
          <p className="text-muted-foreground">
            {avgDuration > 0 ? `Averaging ${formatHours(avgDuration)} a night this week.` : "Track your sleep — the #1 driver of focus."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openLog("nap", today, null)}>
            <Sun className="h-4 w-4" /> Add nap
          </Button>
          <Button onClick={() => openLog("sleep", today, primaryByDate.get(today) ?? null)}>
            <Plus className="h-4 w-4" /> {primaryByDate.get(today) ? "Edit sleep" : "Log sleep"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
      ) : (
        <>
          {/* Dashboard hero */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {heroLog?.date === today ? "Last night" : heroLog ? `Most recent · ${formatLongDate(heroLog.date)}` : "Last night"}
              </span>
              {heroLog && heroLog.date !== today && (
                <Button size="sm" variant="ghost" onClick={() => openLog("sleep", today, primaryByDate.get(today) ?? null)}>Log last night</Button>
              )}
            </div>
            {heroLog ? (
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
                <div className="flex items-center gap-4">
                  <ScoreRing score={heroScore} color={heroMeta.color} />
                  <div>
                    <p className="text-3xl font-bold tabular-nums leading-none">{formatHours(heroLog.hours)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">slept · {heroMeta.label}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <HeroFact icon={<Moon className="h-3.5 w-3.5" />} label="Bedtime" value={heroLog.bedtime ?? "—"} />
                  <HeroFact icon={<Sun className="h-3.5 w-3.5" />} label="Wake up" value={heroLog.wakeTime ?? "—"} />
                  <HeroFact icon={<Clock className="h-3.5 w-3.5" />} label="Time in bed" value={heroLog.bedtime ? formatHours(timeInBedHours(heroLog)) : "—"} />
                  <HeroFact icon={<Flame className="h-3.5 w-3.5" />} label="Goal streak" value={`${streak} ${streak === 1 ? "night" : "nights"}`} />
                  <div className="col-span-2 sm:col-span-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Goal progress</span>
                      <span className="tabular-nums">{formatHours(heroLog.hours)} / {target}h</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (heroLog.hours / target) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <Moon className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No sleep logged yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">Log last night to see your sleep score, duration, and streak.</p>
                <Button onClick={() => openLog("sleep", today, null)}><Plus className="h-4 w-4" /> Log last night&apos;s sleep</Button>
              </div>
            )}
          </Card>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Avg duration (7d)" value={week7.length ? formatHours(avgDuration) : "—"} hint={`${week7.length} of 7 nights`} />
            <StatTile label="Avg score (7d)" value={week7.length ? String(avgScore) : "—"} hint={week7.length ? scoreMeta(avgScore).label : "Log to see"} />
            <StatTile label="Current streak" value={`${streak}`} hint={`nights ≥ ${target}h`} />
            <StatTile
              label="Nightly goal"
              value={
                <NumberField value={target} onCommit={(n) => { setTarget(n); commitGoal({ sleepTarget: n }); }} min={4} max={12} suffix="h" aria-label="Nightly sleep goal" />
              }
              hint="Tap to change"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* This week */}
            <Card className="overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This week</span>
              </div>
              <div className="flex items-end justify-between gap-2 px-4 pb-3 pt-6">
                {last7.map(({ date, log }) => {
                  const h = log?.hours ?? 0;
                  const meta = log ? scoreMeta(sleepScore(log, target)) : null;
                  return (
                    <button key={date} type="button" onClick={() => openDay(date)} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{h > 0 ? formatHours(h) : ""}</span>
                      <div className="flex h-[110px] w-full items-end justify-center">
                        <div
                          className={cn("w-5 rounded-t transition group-hover:opacity-80", !log && "bg-muted")}
                          style={log ? { height: `${Math.max(6, (h / maxBar) * 100)}%`, backgroundColor: meta!.color } : { height: "6px" }}
                        />
                      </div>
                      <span className={cn("text-[10px] font-medium", date === today ? "text-primary" : "text-muted-foreground")}>{weekdayShort(date)}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Goals */}
            <Card className="overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Sleep goals
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Target duration</Label>
                  <NumberField value={target} onCommit={(n) => { setTarget(n); commitGoal({ sleepTarget: n }); }} min={4} max={12} suffix="h" aria-label="Target sleep duration" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="bt" className="text-sm text-muted-foreground">Target bedtime</Label>
                  <Input id="bt" type="time" value={bedtimeTarget} onChange={(e) => setBedtimeTarget(e.target.value)} onBlur={() => commitGoal({ bedtimeTarget: bedtimeTarget || null })} className="h-9 w-[130px]" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="wt" className="text-sm text-muted-foreground">Target wake-up</Label>
                  <Input id="wt" type="time" value={wakeTarget} onChange={(e) => setWakeTarget(e.target.value)} onBlur={() => commitGoal({ wakeTarget: wakeTarget || null })} className="h-9 w-[130px]" />
                </div>
                {napsToday.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s naps</p>
                    <div className="flex flex-wrap gap-1.5">
                      {napsToday.map((n) => (
                        <button key={n.id} type="button" onClick={() => openLog("nap", n.date, n)} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent">
                          <Sun className="h-3 w-3 text-amber-500" /> {formatHours(n.hours)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Month calendar */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setView((v) => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[130px] text-center text-sm font-semibold">{formatMonthYear(view.year, view.month)}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setView((v) => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="ml-1 h-8" onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() })}>This month</Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b bg-muted/10 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date) => {
                const inMonth = isInMonth(date, view.year, view.month);
                const log = primaryByDate.get(date);
                const hasNap = naps.some((n) => n.date === date);
                const meta = log ? scoreMeta(sleepScore(log, target)) : null;
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openDay(date)}
                    className={cn(
                      "relative flex min-h-[64px] flex-col gap-1 border-b border-r p-1.5 text-left transition last:border-r-0 hover:bg-accent",
                      !inMonth && "bg-muted/20 text-muted-foreground/50",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums", isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>{dayNum(date)}</span>
                    {log && (
                      <div className="mt-auto space-y-0.5">
                        <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: meta!.color }} />
                        <p className="text-[10px] font-medium tabular-nums">{formatHours(log.hours)}</p>
                      </div>
                    )}
                    {hasNap && <span className="absolute right-1.5 top-1.5 text-[9px]">☀️</span>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* History */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search date (2026-07)…" className="h-8 w-[190px] pl-7" />
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No entries match that date." : "No sleep logged yet."}</p>
            ) : (
              <div className="divide-y">
                {filtered.map((log) => {
                  const isNap = log.kind === "nap";
                  const meta = isNap ? null : scoreMeta(sleepScore(log, target));
                  const qr = qualityRating(log.quality);
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                      {isNap ? <Sun className="h-4 w-4 shrink-0 text-amber-500" /> : <Moon className="h-4 w-4 shrink-0 text-indigo-400" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatLongDate(log.date)}{isNap ? " · nap" : ""}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {log.bedtime && log.wakeTime ? `${log.bedtime}–${log.wakeTime} · ` : ""}
                          {formatHours(log.hours)} · quality {log.quality}/10 · {qr.label}
                        </p>
                      </div>
                      {meta && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums text-white" style={{ backgroundColor: meta.color }}>
                          {sleepScore(log, target)}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Edit entry" onClick={() => openLog(log.kind, log.date, log)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {user && (
        <SleepLogDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}
          userId={user.uid}
          date={dialog.date}
          kind={dialog.kind}
          entry={dialog.entry}
          onSaved={() => load({ quiet: true })}
        />
      )}
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums leading-none">{score}</span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">score</span>
      </div>
    </div>
  );
}

function HeroFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className="mt-0.5 truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
