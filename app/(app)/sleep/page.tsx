"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Moon,
  Sun,
  Plus,
  Zap,
  HeartPulse,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSleepData, getPrefs, upsertPrefs, upsertSleepMeta, type SleepData } from "@/lib/firebase/db";
import { NumberField } from "@/components/ui/number-field";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import {
  formatHours,
  averageHours,
  sleepScore,
  scoreMeta,
  sleepGoalStreak,
  bedtimeStreak,
  wakeStreak,
  consistencyStreak,
  timeInBedHours,
  averageBedtime,
  averageWake,
  sleepConsistency,
  bestNight,
  worstNight,
  sleepDebt,
  recoveryScore,
  energyToday,
  sleepRecommendation,
  qualityRating,
  parseHM,
  DEFAULT_EVENING_ROUTINE,
  DEFAULT_MORNING_ROUTINE,
  MOODS,
} from "@/lib/sleep";
import { tgSend } from "@/lib/telegram";
import { SleepLogDialog } from "@/components/sleep/sleep-log-dialog";
import { YearHeatmap } from "@/components/sleep/year-heatmap";
import { TrendChart } from "@/components/sleep/trend-chart";
import { RoutineCard } from "@/components/sleep/routine-card";
import { RoutineEditDialog } from "@/components/sleep/routine-edit-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import type { SleepKind, SleepLog, SleepRoutine, TelegramConfig } from "@/lib/types";

function weekdayShort(dateKey: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${dateKey}T00:00:00`).getDay()];
}
function signedHours(diff: number): string {
  return `${diff >= 0 ? "+" : "−"}${formatHours(Math.abs(Math.round(diff * 100) / 100))}`;
}

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
  const maxBar = useMemo(() => Math.max(target + 1, ...week7.map((l) => l.hours), 8), [week7, target]);

  const goalStreak = useMemo(() => sleepGoalStreak(primary, target, today), [primary, target, today]);
  const avgBed = useMemo(() => averageBedtime(primary), [primary]);
  const avgWk = useMemo(() => averageWake(primary), [primary]);
  const bedStreak = useMemo(() => bedtimeStreak(primary, bedtimeTarget || avgBed, today), [primary, bedtimeTarget, avgBed, today]);
  const wkStreak = useMemo(() => wakeStreak(primary, wakeTarget || avgWk, today), [primary, wakeTarget, avgWk, today]);
  const consStreak = useMemo(() => consistencyStreak(primary, today), [primary, today]);
  const consistency = useMemo(() => sleepConsistency(primary), [primary]);
  const best = useMemo(() => bestNight(primary), [primary]);
  const worst = useMemo(() => worstNight(primary), [primary]);
  const avgSleepAll = useMemo(() => averageHours(primary), [primary]);

  const netDebt = useMemo(() => sleepDebt(primary, target, today, 7), [primary, target, today]);
  const recovery = heroLog ? recoveryScore(heroLog, netDebt, target) : 0;
  const recoveryMeta = scoreMeta(recovery);
  const energy = energyToday(recovery, goalStreak);
  const recommendation = useMemo(
    () => sleepRecommendation({ lastLog: heroLog, netDebtHours: netDebt, target, bedtimeTarget: bedtimeTarget || avgBed, goalStreak }),
    [heroLog, netDebt, target, bedtimeTarget, avgBed, goalStreak]
  );

  const tgConnected = Boolean(telegram?.enabled && telegram.botToken && telegram.chatId);
  const notify = tgConnected && telegram!.onSleepLog ? { token: telegram!.botToken, chatId: telegram!.chatId, target } : null;

  async function sendTelegramSummary() {
    if (!telegram || !heroLog) return;
    const text =
      `🌙 <b>Sleep summary</b> — ${formatLongDate(focusDate)}\n` +
      `Score ${score}/100 · ${meta.label}\n` +
      `${formatHours(heroLog.hours)} slept${heroLog.bedtime ? ` (${heroLog.bedtime}–${heroLog.wakeTime})` : ""}\n` +
      `Recovery ${recovery} · Energy ${energy}%\n` +
      `💡 ${recommendation}`;
    const r = await tgSend(telegram.botToken, telegram.chatId, text);
    if (r.ok) {
      setTgSent(true);
      window.setTimeout(() => setTgSent(false), 2500);
    }
  }

  // Monthly goal
  const monthPrefix = today.slice(0, 7);
  const monthLogged = useMemo(() => primary.filter((p) => p.date.startsWith(monthPrefix)), [primary, monthPrefix]);
  const monthHit = monthLogged.filter((p) => p.hours >= target).length;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = monthLogged.length ? Math.round((monthHit / monthLogged.length) * 100) : 0;

  const todayMeta = data.metas[today];
  const eveningDone = todayMeta?.eveningDone ?? [];
  const morningDone = todayMeta?.morningDone ?? [];

  function openLog(kind: SleepKind, date: string, entry: SleepLog | null) {
    setDialog({ open: true, kind, date, entry });
  }
  function commitPref(patch: Parameters<typeof upsertPrefs>[1]) {
    if (user) void upsertPrefs(user.uid, patch);
  }
  function patchTodayMeta(patch: Partial<Parameters<typeof upsertSleepMeta>[2]>) {
    if (!user) return;
    setData((prev) => {
      const existing = prev.metas[today] ?? { date: today, eveningDone: [], morningDone: [], energy: null, mood: null, checkinNotes: null };
      return { ...prev, metas: { ...prev.metas, [today]: { ...existing, ...patch } } };
    });
    void upsertSleepMeta(user.uid, today, patch).catch(() => void load({ quiet: true }));
  }
  function toggleStep(which: "evening" | "morning", id: string) {
    const current = which === "evening" ? eveningDone : morningDone;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    patchTodayMeta(which === "evening" ? { eveningDone: next } : { morningDone: next });
  }
  function saveRoutine(which: "evening" | "morning", steps: SleepRoutine["evening"]) {
    const next = { ...routine, [which]: steps };
    setRoutine(next);
    commitPref({ sleepRoutine: next });
  }

  const recent = useMemo(() => primary.slice(0, 5), [primary]);
  const focusIsToday = focusDate === today;

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
          {/* Top row: score / duration / recovery / energy */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Moon className="h-3.5 w-3.5" /> Sleep score</p>
              {heroLog ? (
                <div className="flex items-center gap-4">
                  <Ring value={score} color={meta.color} suffix="/100" />
                  <div>
                    <p className="text-lg font-bold" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{score >= 70 ? "Keep up the great consistency!" : "Room to improve tonight."}</p>
                  </div>
                </div>
              ) : (
                <EmptyCard onClick={() => openLog("sleep", focusDate, null)} label={focusIsToday ? "Log last night" : "Log this night"} />
              )}
            </Card>

            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Sleep duration</p>
              {heroLog ? (
                <div>
                  <p className="text-3xl font-bold tabular-nums leading-none">{formatHours(heroLog.hours)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Time in bed: {heroLog.bedtime ? formatHours(timeInBedHours(heroLog)) : "—"}
                    {" · "}
                    <span className={heroLog.hours - target >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{signedHours(heroLog.hours - target)} vs goal</span>
                  </p>
                  <div className="mt-3 flex items-end gap-1">
                    {last7.map((d) => {
                      const l = byDate.get(d);
                      const h = l?.hours ?? 0;
                      return <div key={d} className="flex-1 rounded-t bg-indigo-400/70" style={{ height: `${Math.max(3, (h / maxBar) * 34)}px` }} title={`${weekdayShort(d)} ${h ? formatHours(h) : ""}`} />;
                    })}
                  </div>
                  <p className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Moon className="h-3 w-3" /> {heroLog.bedtime ?? "—"}</span>
                    <span className="flex items-center gap-1">{heroLog.wakeTime ?? "—"} <Sun className="h-3 w-3" /></span>
                  </p>
                </div>
              ) : <p className="py-4 text-sm text-muted-foreground">No sleep logged for this day.</p>}
            </Card>

            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><HeartPulse className="h-3.5 w-3.5" /> Recovery</p>
              {heroLog ? (
                <div className="flex items-center gap-4">
                  <Ring value={recovery} color={recoveryMeta.color} />
                  <div>
                    <p className="text-lg font-bold" style={{ color: recoveryMeta.color }}>{recoveryMeta.label}</p>
                    <p className="text-xs text-muted-foreground">{recovery >= 70 ? "Your body is well rested and recovered." : "Recovery is low — take it easy today."}</p>
                  </div>
                </div>
              ) : <p className="py-4 text-sm text-muted-foreground">Log sleep to see recovery.</p>}
            </Card>

            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Zap className="h-3.5 w-3.5" /> Energy today</p>
              {heroLog ? (
                <div>
                  <p className="text-3xl font-bold tabular-nums leading-none">{energy}<span className="text-lg">%</span></p>
                  <p className="mt-1 text-sm font-medium" style={{ color: energy >= 70 ? "#10b981" : energy >= 45 ? "#f59e0b" : "#f43f5e" }}>{energy >= 70 ? "High Energy" : energy >= 45 ? "Moderate" : "Low Energy"}</p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${energy}%`, backgroundColor: energy >= 70 ? "#10b981" : energy >= 45 ? "#f59e0b" : "#f43f5e" }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0%</span><span>100%</span></div>
                </div>
              ) : <p className="py-4 text-sm text-muted-foreground">Log sleep to predict energy.</p>}
            </Card>
          </div>

          {/* Daily recommendation */}
          {heroLog && (
            <Card className="flex items-start gap-2 border-primary/20 bg-primary/5 p-3 text-sm">
              <span>💡</span>
              <p className="flex-1">{recommendation}</p>
              {tgConnected && (
                <Button size="sm" variant="ghost" className="shrink-0" onClick={sendTelegramSummary}>
                  <Send className="h-3.5 w-3.5" /> {tgSent ? "Sent ✓" : "Send to Telegram"}
                </Button>
              )}
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            {/* Main column */}
            <div className="space-y-4">
              {/* Heatmap */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep calendar · 365 days</span></div>
                <div className="p-4">
                  <YearHeatmap hoursByDate={hoursByDate} today={today} onSelect={(d) => openLog("sleep", d, byDate.get(d) ?? null)} />
                </div>
              </Card>

              {/* Trends */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep trend · this week</span></div>
                  <div className="p-3">
                    <TrendChart
                      categories={last7.map(weekdayShort)}
                      series={[{ label: "Sleep", color: "#818cf8", points: last7.map((d) => byDate.get(d)?.hours ?? null) }]}
                      goal={target}
                      goalLabel={`Goal ${target}h`}
                      format={formatHours}
                      min={0}
                      max={Math.max(10, target + 1)}
                      showValues
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
                      format={(v) => `${String(Math.floor((v % 1440) / 60)).padStart(2, "0")}:${String(Math.round(v % 60)).padStart(2, "0")}`}
                    />
                  </div>
                </Card>
              </div>

              {/* Routines */}
              <div className="grid gap-4 md:grid-cols-2">
                <RoutineCard title="Evening routine" icon={<Moon className="h-3.5 w-3.5" />} steps={routine.evening} done={eveningDone} onToggle={(id) => toggleStep("evening", id)} onEdit={() => setRoutineEdit("evening")} />
                <RoutineCard title="Morning routine" icon={<Sun className="h-3.5 w-3.5" />} steps={routine.morning} done={morningDone} onToggle={(id) => toggleStep("morning", id)} onEdit={() => setRoutineEdit("morning")} />
              </div>

              {/* Recent sessions */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent sleep sessions</span></div>
                {recent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sleep logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-2 font-medium">Date</th>
                          <th className="px-2 py-2 font-medium">Sleep</th>
                          <th className="px-2 py-2 font-medium">In bed</th>
                          <th className="px-2 py-2 font-medium">Score</th>
                          <th className="px-2 py-2 font-medium">Quality</th>
                          <th className="px-4 py-2 font-medium">Notes</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((l) => {
                          const sm = scoreMeta(sleepScore(l, target));
                          const qr = qualityRating(l.quality);
                          return (
                            <tr key={l.id} className="border-b last:border-0">
                              <td className="px-4 py-2 font-medium">{formatLongDate(l.date)}</td>
                              <td className="px-2 py-2 tabular-nums">{formatHours(l.hours)}</td>
                              <td className="px-2 py-2 tabular-nums text-muted-foreground">{l.bedtime ? formatHours(timeInBedHours(l)) : "—"}</td>
                              <td className="px-2 py-2"><span className="rounded-full px-1.5 text-xs font-medium tabular-nums text-white" style={{ backgroundColor: sm.color }}>{sleepScore(l, target)}</span></td>
                              <td className="px-2 py-2 text-xs" style={{ color: qr.variant === "success" ? "#10b981" : qr.variant === "warning" ? "#f59e0b" : "#f43f5e" }}>● {qr.label}</td>
                              <td className="max-w-[160px] truncate px-4 py-2 text-muted-foreground">{l.notes ?? "—"}</td>
                              <td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Edit" onClick={() => openLog("sleep", l.date, l)}><Pencil className="h-3.5 w-3.5" /></Button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Right column */}
            <aside className="space-y-4">
              {/* Streaks */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current streaks</span></div>
                <div className="p-2">
                  <StreakRow icon="🔥" label="Sleep goal streak" value={goalStreak} />
                  <StreakRow icon="🌙" label="Bedtime streak" value={bedStreak} />
                  <StreakRow icon="☀️" label="Wake-up streak" value={wkStreak} />
                  <StreakRow icon="✨" label="Consistency streak" value={consStreak} />
                </div>
              </Card>

              {/* Summary */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sleep summary</span></div>
                <div className="divide-y">
                  <SummaryRow label="Average sleep" value={primary.length ? formatHours(avgSleepAll) : "—"} />
                  <SummaryRow label="Average bedtime" value={avgBed ?? "—"} />
                  <SummaryRow label="Average wake-up" value={avgWk ?? "—"} />
                  <SummaryRow label="Sleep consistency" value={consistency != null ? `${consistency}%` : "—"} />
                  <SummaryRow label="Best night" value={best ? formatHours(best.hours) : "—"} sub={best ? formatLongDate(best.date) : undefined} />
                  <SummaryRow label="Worst night" value={worst ? formatHours(worst.hours) : "—"} sub={worst ? formatLongDate(worst.date) : undefined} />
                </div>
              </Card>

              {/* Monthly goal */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly goal</span></div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sleep {target}h per night</span>
                    <span className="font-semibold tabular-nums">{monthHit}/{monthLogged.length} days</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${monthPct}%` }} /></div>
                  <p className="text-xs text-muted-foreground">{monthPct}% of tracked nights on goal this month</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const dd = `${monthPrefix}-${String(i + 1).padStart(2, "0")}`;
                      const l = byDate.get(dd);
                      const hit = l && l.hours >= target;
                      const future = dd > today;
                      return <span key={dd} title={dd} className={cn("h-3 w-3 rounded-full", future ? "bg-muted/40" : hit ? "bg-emerald-500" : l ? "bg-amber-500/70" : "bg-muted")} />;
                    })}
                  </div>
                </div>
              </Card>

              {/* Morning check-in */}
              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Morning check-in</span></div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">How do you feel?</p>
                    <div className="flex gap-1.5">
                      {MOODS.map((m, i) => (
                        <button key={m} type="button" onClick={() => patchTodayMeta({ mood: m, energy: i + 1 })} className={cn("flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition", todayMeta?.mood === m ? "border-primary bg-primary/10" : "hover:bg-accent")}>{m}</button>
                      ))}
                    </div>
                  </div>
                  {naps.filter((n) => n.date === today).length > 0 && (
                    <div className="border-t pt-2">
                      <p className="mb-1.5 text-xs text-muted-foreground">Today&apos;s naps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {naps.filter((n) => n.date === today).map((n) => (
                          <button key={n.id} type="button" onClick={() => openLog("nap", n.date, n)} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent"><Sun className="h-3 w-3 text-amber-500" /> {formatHours(n.hours)}</button>
                        ))}
                      </div>
                    </div>
                  )}
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
          <SleepLogDialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))} userId={user.uid} date={dialog.date} kind={dialog.kind} entry={dialog.entry} notify={notify} onSaved={() => load({ quiet: true })} />
          <RoutineEditDialog open={routineEdit === "evening"} onOpenChange={(o) => !o && setRoutineEdit(null)} title="Evening routine" steps={routine.evening} onSave={(s) => saveRoutine("evening", s)} />
          <RoutineEditDialog open={routineEdit === "morning"} onOpenChange={(o) => !o && setRoutineEdit(null)} title="Morning routine" steps={routine.morning} onSave={(s) => saveRoutine("morning", s)} />
        </>
      )}
    </div>
  );
}

function Ring({ value, color, suffix }: { value: number; color: string; suffix?: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none">{value}</span>
        {suffix && <span className="text-[8px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function EmptyCard({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2 py-1">
      <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>
      <Button size="sm" onClick={onClick}><Plus className="h-4 w-4" /> {label}</Button>
    </div>
  );
}

function StreakRow({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
      <span>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{value} {value === 1 ? "day" : "days"}</span>
    </div>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-col items-end text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
