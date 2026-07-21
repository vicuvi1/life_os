"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, Sun, Plus, ChevronLeft, ChevronRight, Send, Bot, StickyNote } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSleepData, getPrefs, upsertPrefs, upsertSleepMeta, type SleepData } from "@/lib/firebase/db";
import { NumberField } from "@/components/ui/number-field";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate, formatMonthYear, monthGrid, isInMonth, dayNum } from "@/lib/dates";
import {
  formatHours, averageHours, sleepScore, scoreMeta, sleepGoalStreak, longestGoalStreak,
  bedtimeStreak, wakeStreak, consistencyStreak, timeInBedHours, averageBedtime, averageWake,
  sleepConsistency, averageRecovery, sleepDebt, recoveryScore, energyToday, sleepRecommendations,
  bestNight, worstNight, parseHM, minutesToHM, MOODS,
  DEFAULT_EVENING_ROUTINE, DEFAULT_MORNING_ROUTINE,
} from "@/lib/sleep";
import { tgSend } from "@/lib/telegram";
import { SleepLogDialog } from "@/components/sleep/sleep-log-dialog";
import { YearHeatmap } from "@/components/sleep/year-heatmap";
import { TrendChart } from "@/components/sleep/trend-chart";
import { RoutineCard } from "@/components/sleep/routine-card";
import { RoutineEditDialog } from "@/components/sleep/routine-edit-dialog";
import { SleepDaySheet } from "@/components/sleep/day-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SleepKind, SleepLog, SleepRoutine, TelegramConfig } from "@/lib/types";

function weekdayShort(dateKey: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${dateKey}T00:00:00`).getDay()];
}
function signedHours(diff: number): string {
  return `${diff >= 0 ? "+" : "−"}${formatHours(Math.abs(Math.round(diff * 100) / 100))}`;
}
const SCALE = ["😣", "😕", "😐", "🙂", "😄"];

export default function SleepPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const now = useMemo(() => new Date(), []);

  const [data, setData] = useState<SleepData>({ entries: [], metas: {} });
  const [target, setTarget] = useState(8);
  const [bedtimeTarget, setBedtimeTarget] = useState("");
  const [wakeTarget, setWakeTarget] = useState("");
  const [routine, setRoutine] = useState<SleepRoutine>({ evening: DEFAULT_EVENING_ROUTINE, morning: DEFAULT_MORNING_ROUTINE });
  const [telegram, setTelegram] = useState<TelegramConfig | null>(null);
  const [tgSent, setTgSent] = useState(false);
  const [loading, setLoading] = useState(true);

  const [focusDate, setFocusDate] = useState(today);
  const [dialog, setDialog] = useState<{ open: boolean; kind: SleepKind; date: string; entry: SleepLog | null }>({ open: false, kind: "sleep", date: today, entry: null });
  const [routineEdit, setRoutineEdit] = useState<null | "evening" | "morning">(null);
  const [calView, setCalView] = useState<"month" | "year">("year");
  const [monthView, setMonthView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [d, prefs] = await Promise.all([getSleepData(user.uid), getPrefs(user.uid)]);
      setData(d);
      setTarget(prefs.sleepTarget);
      setBedtimeTarget(prefs.bedtimeTarget ?? "");
      setWakeTarget(prefs.wakeTarget ?? "");
      setRoutine(prefs.sleepRoutine ?? { evening: DEFAULT_EVENING_ROUTINE, morning: DEFAULT_MORNING_ROUTINE });
      setTelegram(prefs.telegram ?? null);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const primary = useMemo(() => data.entries.filter((e) => e.kind !== "nap" && e.hours > 0), [data.entries]);
  const naps = useMemo(() => data.entries.filter((e) => e.kind === "nap"), [data.entries]);
  const byDate = useMemo(() => new Map(primary.map((p) => [p.date, p])), [primary]);
  const hoursByDate = useMemo(() => Object.fromEntries(primary.map((p) => [p.date, p.hours])), [primary]);

  const heroLog = byDate.get(focusDate) ?? null;
  const score = heroLog ? sleepScore(heroLog, target) : 0;
  const meta = scoreMeta(score);

  const last7 = useMemo(() => [6, 5, 4, 3, 2, 1, 0].map((d) => addDays(today, -d)), [today]);
  const week7 = useMemo(() => last7.map((d) => byDate.get(d)).filter((l): l is SleepLog => Boolean(l)), [last7, byDate]);
  const avgDuration = useMemo(() => averageHours(week7), [week7]);
  const avgScore = useMemo(() => (week7.length ? Math.round(week7.reduce((s, l) => s + sleepScore(l, target), 0) / week7.length) : 0), [week7, target]);
  const maxBar = useMemo(() => Math.max(target + 1, ...week7.map((l) => l.hours), 8), [week7, target]);

  const goalStreak = useMemo(() => sleepGoalStreak(primary, target, today), [primary, target, today]);
  const longest = useMemo(() => longestGoalStreak(primary, target), [primary, target]);
  const avgBed = useMemo(() => averageBedtime(primary), [primary]);
  const avgWk = useMemo(() => averageWake(primary), [primary]);
  const bedStreak = useMemo(() => bedtimeStreak(primary, bedtimeTarget || avgBed, today), [primary, bedtimeTarget, avgBed, today]);
  const wkStreak = useMemo(() => wakeStreak(primary, wakeTarget || avgWk, today), [primary, wakeTarget, avgWk, today]);
  const consStreak = useMemo(() => consistencyStreak(primary, today), [primary, today]);
  const consistency = useMemo(() => sleepConsistency(primary), [primary]);
  const avgRecovery = useMemo(() => averageRecovery(primary, target, today, 7), [primary, target, today]);
  const best = useMemo(() => bestNight(primary), [primary]);
  const worst = useMemo(() => worstNight(primary), [primary]);

  const netDebt = useMemo(() => sleepDebt(primary, target, today, 7), [primary, target, today]);
  const debtHours = netDebt < 0 ? Math.abs(netDebt) : 0;
  const recovery = heroLog ? recoveryScore(heroLog, netDebt, target) : 0;
  const recoveryMeta = scoreMeta(recovery);
  const energy = energyToday(recovery, goalStreak);
  const tips = useMemo(
    () => sleepRecommendations({ lastLog: heroLog, netDebtHours: netDebt, target, bedtimeTarget: bedtimeTarget || avgBed, goalStreak }),
    [heroLog, netDebt, target, bedtimeTarget, avgBed, goalStreak]
  );

  const tgConnected = Boolean(telegram?.enabled && telegram.botToken && telegram.chatId);

  // Monthly goal mini-calendar (current calendar month).
  const monthPrefix = today.slice(0, 7);
  const monthLogged = useMemo(() => primary.filter((p) => p.date.startsWith(monthPrefix)), [primary, monthPrefix]);
  const monthHit = monthLogged.filter((p) => p.hours >= target).length;
  const monthPct = monthLogged.length ? Math.round((monthHit / monthLogged.length) * 100) : 0;
  const goalCells = useMemo(() => monthGrid(now.getFullYear(), now.getMonth()), [now]);

  const todayMeta = data.metas[today];
  const eveningDone = todayMeta?.eveningDone ?? [];
  const morningDone = todayMeta?.morningDone ?? [];
  useEffect(() => { setNote(todayMeta?.checkinNotes ?? ""); }, [todayMeta?.checkinNotes]);

  function openLog(kind: SleepKind, date: string, entry: SleepLog | null) { setDialog({ open: true, kind, date, entry }); }
  function commitPref(patch: Parameters<typeof upsertPrefs>[1]) { if (user) void upsertPrefs(user.uid, patch); }

  function patchTodayMeta(patch: Partial<Parameters<typeof upsertSleepMeta>[2]>) {
    if (!user) return;
    setData((prev) => {
      const existing = prev.metas[today] ?? { date: today, eveningDone: [], morningDone: [], energy: null, mood: null, stress: null, recoveryFeel: null, checkinNotes: null };
      return { ...prev, metas: { ...prev.metas, [today]: { ...existing, ...patch } } };
    });
    void upsertSleepMeta(user.uid, today, patch).catch(() => void load({ quiet: true }));
  }
  function toggleStep(which: "evening" | "morning", id: string) {
    const current = which === "evening" ? eveningDone : morningDone;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    patchTodayMeta(which === "evening" ? { eveningDone: next } : { morningDone: next });
  }
  function setAllSteps(which: "evening" | "morning", done: boolean) {
    const ids = done ? (which === "evening" ? routine.evening : routine.morning).map((s) => s.id) : [];
    patchTodayMeta(which === "evening" ? { eveningDone: ids } : { morningDone: ids });
  }
  function saveRoutine(which: "evening" | "morning", steps: SleepRoutine["evening"]) {
    const next = { ...routine, [which]: steps };
    setRoutine(next);
    commitPref({ sleepRoutine: next });
  }

  async function sendTelegramSummary() {
    if (!telegram || !heroLog) return;
    const text =
      `🌙 <b>Sleep summary</b> — ${formatLongDate(focusDate)}\n` +
      `Score ${score}/100 · ${meta.label}\n${formatHours(heroLog.hours)} slept${heroLog.bedtime ? ` (${heroLog.bedtime}–${heroLog.wakeTime})` : ""}\n` +
      `Recovery ${recovery} · Energy ${energy}%\n💡 ${tips[0]}`;
    const r = await tgSend(telegram.botToken, telegram.chatId, text);
    if (r.ok) { setTgSent(true); window.setTimeout(() => setTgSent(false), 2500); }
  }

  // Agent card insights (computed from data — heuristic, honest).
  const wakeMin = parseHM(avgWk ?? wakeTarget);
  const focusWindow = wakeMin != null ? `${minutesToHM(wakeMin + 150)}–${minutesToHM(wakeMin + 330)}` : "mid-morning";
  const readiness = recovery >= 70 ? "Excellent" : recovery >= 50 ? "Moderate" : "Take it easy";
  const bedReminder = (() => { const m = parseHM(bedtimeTarget || avgBed); return m != null ? minutesToHM((m + 1440 - 20) % 1440) : "—"; })();

  const focusIsToday = focusDate === today;
  const sheetLog = sheetDate ? byDate.get(sheetDate) ?? null : null;
  const sheetNaps = useMemo(() => (sheetDate ? naps.filter((n) => n.date === sheetDate) : []), [naps, sheetDate]);

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Moon className="h-6 w-6 text-indigo-400" /> Sleep</h1>
          <p className="text-muted-foreground">Understand your sleep. Improve your life.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => setFocusDate((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" onClick={() => setFocusDate(today)} className="min-w-[150px] text-center text-sm font-medium">{formatLongDate(focusDate)}</button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next day" disabled={focusIsToday} onClick={() => setFocusDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" onClick={() => openLog("nap", focusDate, null)}><Sun className="h-4 w-4" /> Nap</Button>
          <Button onClick={() => openLog("sleep", focusDate, byDate.get(focusDate) ?? null)}><Plus className="h-4 w-4" /> {byDate.get(focusDate) ? "Edit sleep" : "Log sleep"}</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard lines={4} /><SkeletonCard lines={8} /></div>
      ) : (
        <>
          {/* Adaptive hero */}
          {heroLog ? (
            <Card className="grid gap-5 p-5 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <Ring value={score} color={meta.color} suffix="/100" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sleep score</p>
                  <p className="text-lg font-bold" style={{ color: meta.color }}>{meta.label}</p>
                </div>
              </div>
              <div className="md:border-l md:pl-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="text-2xl font-bold tabular-nums leading-tight">{formatHours(heroLog.hours)}</p>
                <p className="text-[11px] text-muted-foreground">In bed {heroLog.bedtime ? formatHours(timeInBedHours(heroLog)) : "—"} · <span className={heroLog.hours - target >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{signedHours(heroLog.hours - target)}</span></p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Moon className="h-3 w-3" /> {heroLog.bedtime ?? "—"} → {heroLog.wakeTime ?? "—"} <Sun className="h-3 w-3" /></p>
                <div className="mt-2 flex items-end gap-1">
                  {last7.map((d) => { const h = byDate.get(d)?.hours ?? 0; return <div key={d} className="flex-1 rounded-t bg-indigo-400/70" style={{ height: `${Math.max(3, (h / maxBar) * 28)}px` }} title={`${weekdayShort(d)} ${h ? formatHours(h) : ""}`} />; })}
                </div>
              </div>
              <div className="flex items-center gap-3 md:border-l md:pl-5">
                <Ring value={recovery} color={recoveryMeta.color} small />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Recovery</p>
                  <p className="text-lg font-bold" style={{ color: recoveryMeta.color }}>{recoveryMeta.label}</p>
                </div>
              </div>
              <div className="md:border-l md:pl-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Today&apos;s energy</p>
                <p className="text-2xl font-bold tabular-nums leading-tight">{energy}%</p>
                <p className="text-sm font-medium" style={{ color: energy >= 70 ? "#10b981" : energy >= 45 ? "#f59e0b" : "#f43f5e" }}>{energy >= 70 ? "High energy" : energy >= 45 ? "Moderate" : "Low energy"}</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${energy}%`, backgroundColor: energy >= 70 ? "#10b981" : energy >= 45 ? "#f59e0b" : "#f43f5e" }} /></div>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="text-5xl">🌙</span>
              <p className="text-lg font-semibold">{new Date().getHours() < 12 ? "Good morning" : "Good evening"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {focusIsToday ? "No sleep recorded yet." : `Nothing logged for ${formatLongDate(focusDate)}.`} Log last night to unlock your score, recovery, and energy.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => openLog("sleep", focusDate, null)}><Plus className="h-4 w-4" /> Log last night</Button>
                <Button variant="outline" onClick={() => openLog("nap", focusDate, null)}><Sun className="h-4 w-4" /> Start a nap</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Smartwatch / Apple Health import is on the roadmap — needs a device integration.</p>
            </Card>
          )}

          {/* Recommendation */}
          {heroLog && (
            <Card className="border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">💡 Today&apos;s recommendation</p>
                {tgConnected && <Button size="sm" variant="ghost" onClick={sendTelegramSummary}><Send className="h-3.5 w-3.5" /> {tgSent ? "Sent ✓" : "Telegram"}</Button>}
              </div>
              <ul className="mt-1.5 space-y-1 text-sm">
                {tips.map((t, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{t}</li>)}
              </ul>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            {/* Main column */}
            <div className="space-y-4">
              {/* Calendar */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep calendar</span>
                  <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                    {(["month", "year"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setCalView(v)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition", calView === v ? "bg-background shadow-sm" : "text-muted-foreground")}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  {calView === "year" ? (
                    <YearHeatmap hoursByDate={hoursByDate} today={today} onSelect={(d) => setSheetDate(d)} />
                  ) : (
                    <MonthCalendar view={monthView} setView={setMonthView} byDate={byDate} naps={naps} target={target} today={today} onSelect={(d) => setSheetDate(d)} />
                  )}
                </div>
              </Card>

              {/* Trends */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep trend · this week</span>
                  </div>
                  <div className="p-3">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-muted-foreground">Avg <span className="font-semibold text-foreground">{week7.length ? formatHours(avgDuration) : "—"}</span></span>
                      <span className="text-muted-foreground">Goal <span className="font-semibold text-foreground">{target}h</span></span>
                      <span className="text-muted-foreground">Diff <span className={cn("font-semibold", avgDuration - target >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{week7.length ? signedHours(avgDuration - target) : "—"}</span></span>
                    </div>
                    <TrendChart
                      categories={last7.map(weekdayShort)}
                      series={[{ label: "Sleep", color: "#818cf8", points: last7.map((d) => byDate.get(d)?.hours ?? null) }]}
                      goal={target}
                      goalLabel={`Goal ${target}h`}
                      format={formatHours}
                      min={0}
                      max={Math.max(10, target + 1)}
                      showValues
                      markers={[
                        best && last7.includes(best.date) ? { index: last7.indexOf(best.date), kind: "best" as const } : null,
                        worst && last7.includes(worst.date) ? { index: last7.indexOf(worst.date), kind: "worst" as const } : null,
                      ].filter((m): m is { index: number; kind: "best" | "worst" } => Boolean(m))}
                    />
                  </div>
                </Card>
                <Card className="overflow-hidden">
                  <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bedtime & wake-up · this week</span></div>
                  <div className="p-3">
                    <TrendChart
                      categories={last7.map(weekdayShort)}
                      series={[
                        { label: "Bedtime", color: "#a78bfa", points: last7.map((d) => { const m = parseHM(byDate.get(d)?.bedtime ?? null); return m == null ? null : m < 720 ? m + 1440 : m; }) },
                        { label: "Wake-up", color: "#fbbf24", points: last7.map((d) => parseHM(byDate.get(d)?.wakeTime ?? null)) },
                      ]}
                      format={(v) => minutesToHM(((v % 1440) + 1440) % 1440)}
                      band={(() => { const b = parseHM(bedtimeTarget); if (b == null) return null; const n = b < 720 ? b + 1440 : b; return { from: n - 30, to: n + 30, color: "#a78bfa" }; })()}
                    />
                  </div>
                </Card>
              </div>

              {/* Routines */}
              <div className="grid gap-4 md:grid-cols-2">
                <RoutineCard title="Evening routine" icon={<Moon className="h-3.5 w-3.5" />} steps={routine.evening} done={eveningDone} onToggle={(id) => toggleStep("evening", id)} onEdit={() => setRoutineEdit("evening")} onSetAll={(d) => setAllSteps("evening", d)} />
                <RoutineCard title="Morning routine" icon={<Sun className="h-3.5 w-3.5" />} steps={routine.morning} done={morningDone} onToggle={(id) => toggleStep("morning", id)} onEdit={() => setRoutineEdit("morning")} onSetAll={(d) => setAllSteps("morning", d)} />
              </div>

              {/* Agent activity */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Bot className="h-3.5 w-3.5 text-primary" /> Life Agent</span>
                  <Link href="/hub/agents?id=default-sleep" className="text-xs text-primary hover:underline">View insights →</Link>
                </div>
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-muted-foreground">{heroLog ? <>Last night you slept <span className="font-medium text-foreground">{formatHours(heroLog.hours)}</span>. Based on your patterns:</> : "Log a night and I'll tailor your day."}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <AgentStat label="Best focus window" value={focusWindow} />
                    <AgentStat label="Workout readiness" value={readiness} />
                    <AgentStat label="Suggested bedtime" value={bedReminder} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right column */}
            <aside className="space-y-4">
              {/* Streaks */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current streaks</span></div>
                <div className="flex items-center gap-3 p-4">
                  <Ring value={longest ? Math.round((goalStreak / longest) * 100) : 0} color="#f59e0b" small centerText={`${goalStreak}`} />
                  <div className="flex-1">
                    <StreakRow icon="🔥" label="Sleep goal" value={goalStreak} />
                    <StreakRow icon="🌙" label="Bedtime" value={bedStreak} />
                    <StreakRow icon="☀️" label="Wake-up" value={wkStreak} />
                    <StreakRow icon="✨" label="Consistency" value={consStreak} />
                    <div className="mt-1 flex items-center gap-2 border-t pt-1.5 text-sm">
                      <span>🏆</span><span className="flex-1 text-muted-foreground">Longest</span><span className="font-semibold tabular-nums">{longest} days</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Summary */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep summary · 7 days</span></div>
                <div className="divide-y">
                  <SummaryRow label="Average score" value={week7.length ? String(avgScore) : "—"} />
                  <SummaryRow label="Average duration" value={week7.length ? formatHours(avgDuration) : "—"} />
                  <SummaryRow label="Consistency" value={consistency != null ? `${consistency}%` : "—"} />
                  <SummaryRow label="Average recovery" value={avgRecovery != null ? String(avgRecovery) : "—"} />
                  <SummaryRow label="Sleep debt" value={debtHours > 0 ? formatHours(debtHours) : netDebt > 0 ? `+${formatHours(netDebt)} surplus` : "None"} accent={debtHours > 0} />
                </div>
              </Card>

              {/* Sleep debt bar */}
              {(debtHours > 0 || netDebt > 0) && (
                <Card className="p-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{debtHours > 0 ? "Sleep debt" : "Sleep surplus"}</span>
                    <span className="tabular-nums font-semibold" style={{ color: debtHours > 0 ? "#f43f5e" : "#10b981" }}>{formatHours(Math.abs(netDebt))}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(netDebt) / (target * 0.9)) * 100)}%`, backgroundColor: debtHours > 0 ? "#f43f5e" : "#10b981" }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Net over the last 7 nights vs your {target}h goal.</p>
                </Card>
              )}

              {/* Monthly goal mini-calendar */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly goal — {formatMonthYear(now.getFullYear(), now.getMonth())}</span></div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Sleep {target}h per night</span><span className="font-semibold tabular-nums">{monthHit}/{monthLogged.length} · {monthPct}%</span></div>
                  <div className="grid grid-cols-7 gap-1">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="text-center text-[9px] text-muted-foreground">{d}</span>)}
                    {goalCells.flat().map((dd) => {
                      const inM = isInMonth(dd, now.getFullYear(), now.getMonth());
                      const l = byDate.get(dd);
                      const future = dd > today;
                      const hit = l && l.hours >= target;
                      return (
                        <button key={dd} type="button" onClick={() => inM && setSheetDate(dd)} disabled={!inM} className={cn("flex aspect-square items-center justify-center rounded text-[10px]", !inM && "opacity-0", inM && (future ? "bg-muted/40 text-muted-foreground/50" : hit ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : l ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground/60"))}>
                          {inM && !future ? (hit ? "✓" : l ? "✕" : dayNum(dd)) : inM ? dayNum(dd) : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Morning check-in */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Morning check-in</span></div>
                <div className="space-y-3 p-4">
                  <ScaleRow label="😊 Mood" options={MOODS} value={todayMeta?.mood ? MOODS.indexOf(todayMeta.mood) + 1 : null} onPick={(i) => patchTodayMeta({ mood: MOODS[i - 1] })} />
                  <ScaleRow label="⚡ Energy" options={SCALE} value={todayMeta?.energy ?? null} onPick={(i) => patchTodayMeta({ energy: i })} />
                  <ScaleRow label="😌 Stress" options={SCALE} value={todayMeta?.stress ?? null} onPick={(i) => patchTodayMeta({ stress: i })} />
                  <ScaleRow label="💪 Recovered" options={SCALE} value={todayMeta?.recoveryFeel ?? null} onPick={(i) => patchTodayMeta({ recoveryFeel: i })} />
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><StickyNote className="h-3 w-3" /> Notes</p>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => patchTodayMeta({ checkinNotes: note.trim() || null })} rows={2} placeholder="Dreams, how you feel, anything…" />
                  </div>
                </div>
              </Card>

              {/* Goals */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep goals</span></div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between"><Label className="text-sm text-muted-foreground">Target duration</Label><NumberField value={target} onCommit={(n) => { setTarget(n); commitPref({ sleepTarget: n }); }} min={4} max={12} suffix="h" aria-label="Target sleep duration" /></div>
                  <div className="flex items-center justify-between gap-3"><Label htmlFor="bt" className="text-sm text-muted-foreground">Target bedtime</Label><Input id="bt" type="time" value={bedtimeTarget} onChange={(e) => setBedtimeTarget(e.target.value)} onBlur={() => commitPref({ bedtimeTarget: bedtimeTarget || null })} className="h-9 w-[130px]" /></div>
                  <div className="flex items-center justify-between gap-3"><Label htmlFor="wt" className="text-sm text-muted-foreground">Target wake-up</Label><Input id="wt" type="time" value={wakeTarget} onChange={(e) => setWakeTarget(e.target.value)} onBlur={() => commitPref({ wakeTarget: wakeTarget || null })} className="h-9 w-[130px]" /></div>
                </div>
              </Card>
            </aside>
          </div>
        </>
      )}

      {user && (
        <>
          <SleepLogDialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))} userId={user.uid} date={dialog.date} kind={dialog.kind} entry={dialog.entry} notify={tgConnected && telegram!.onSleepLog ? { token: telegram!.botToken, chatId: telegram!.chatId, target } : null} onSaved={() => load({ quiet: true })} />
          <RoutineEditDialog open={routineEdit === "evening"} onOpenChange={(o) => !o && setRoutineEdit(null)} title="Evening routine" steps={routine.evening} onSave={(s) => saveRoutine("evening", s)} />
          <RoutineEditDialog open={routineEdit === "morning"} onOpenChange={(o) => !o && setRoutineEdit(null)} title="Morning routine" steps={routine.morning} onSave={(s) => saveRoutine("morning", s)} />
          <SleepDaySheet open={sheetDate !== null} onOpenChange={(o) => !o && setSheetDate(null)} date={sheetDate} log={sheetLog} meta={sheetDate ? data.metas[sheetDate] : undefined} naps={sheetNaps} allSleep={primary} target={target} onEdit={(d) => { setSheetDate(null); openLog("sleep", d, byDate.get(d) ?? null); }} />
        </>
      )}
    </div>
  );
}

function MonthCalendar({ view, setView, byDate, naps, target, today, onSelect }: {
  view: { year: number; month: number };
  setView: (v: { year: number; month: number }) => void;
  byDate: Map<string, SleepLog>;
  naps: SleepLog[];
  target: number;
  today: string;
  onSelect: (d: string) => void;
}) {
  const cells = monthGrid(view.year, view.month).flat();
  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { const d = new Date(view.year, view.month - 1, 1); setView({ year: d.getFullYear(), month: d.getMonth() }); }}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[130px] text-center text-sm font-semibold">{formatMonthYear(view.year, view.month)}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { const d = new Date(view.year, view.month + 1, 1); setView({ year: d.getFullYear(), month: d.getMonth() }); }}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="pb-1 text-center text-[10px] uppercase text-muted-foreground">{d}</span>)}
        {cells.map((dd) => {
          const inM = isInMonth(dd, view.year, view.month);
          const l = byDate.get(dd);
          const m = l ? scoreMeta(sleepScore(l, target)) : null;
          const isToday = dd === today;
          const hasNap = naps.some((n) => n.date === dd);
          return (
            <button key={dd} type="button" onClick={() => onSelect(dd)} className={cn("relative flex min-h-[48px] flex-col items-center rounded-lg border p-1 text-left transition hover:bg-accent", !inM && "opacity-30", isToday && "ring-1 ring-primary")}>
              <span className="text-[10px] tabular-nums text-muted-foreground">{dayNum(dd)}</span>
              {l && <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m!.color }} />}
              {l && <span className="text-[9px] font-medium tabular-nums">{formatHours(l.hours)}</span>}
              {hasNap && <span className="absolute right-0.5 top-0.5 text-[8px]">☀️</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Ring({ value, color, suffix, small, centerText }: { value: number; color: string; suffix?: string; small?: boolean; centerText?: string }) {
  const size = small ? 56 : 72;
  const r = small ? 22 : 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={small ? 6 : 7} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={small ? 6 : 7} strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold tabular-nums leading-none", small ? "text-base" : "text-xl")}>{centerText ?? value}</span>
        {suffix && <span className="text-[8px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function ScaleRow({ label, options, value, onPick }: { label: string; options: string[]; value: number | null; onPick: (i: number) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-1.5">
        {options.map((o, i) => (
          <button key={i} type="button" onClick={() => onPick(i + 1)} className={cn("flex h-9 flex-1 items-center justify-center rounded-lg border text-base transition", value === i + 1 ? "border-primary bg-primary/10" : "hover:bg-accent")}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function AgentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function StreakRow({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-sm">
      <span>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", accent && "text-rose-600 dark:text-rose-400")}>{value}</span>
    </div>
  );
}
