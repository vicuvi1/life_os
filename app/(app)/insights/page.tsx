"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Target,
  CheckCircle2,
  Flame,
  TrendingUp,
  Moon,
  GlassWater,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoals,
  getTasks,
  getHabits,
  getHabitLogs,
  getSleepLogs,
  getNutritionLogs,
  getTrackers,
  getTrackerLogs,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays, isLogDone } from "@/lib/habits";
import { averageHours, formatHours } from "@/lib/sleep";
import { trackerIcon, formatTrackerValue } from "@/lib/trackers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";
import { HabitHeatmap } from "@/components/insights/habit-heatmap";
import { cn } from "@/lib/utils";
import type {
  Goal,
  Habit,
  HabitLog,
  NutritionLog,
  SleepLog,
  Task,
  Tracker,
  TrackerLog,
} from "@/lib/types";

interface InsightsData {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  sleepLogs: SleepLog[];
  nutritionLogs: NutritionLog[];
  trackers: Tracker[];
  trackerLogs: TrackerLog[];
}

// Session-scoped cache so navigating away and back doesn't refetch and
// re-render charts that haven't changed. A short TTL keeps freshly logged
// data from looking stale for long; a full page reload always refetches.
const INSIGHTS_CACHE_TTL_MS = 60_000;
let insightsCache: { uid: string; data: InsightsData; ts: number } | null = null;

/** Stable empty dataset so `data ?? EMPTY_DATA` keeps referential equality. */
const EMPTY_DATA: InsightsData = {
  goals: [],
  tasks: [],
  habits: [],
  logs: [],
  sleepLogs: [],
  nutritionLogs: [],
  trackers: [],
  trackerLogs: [],
};

function cacheValid(uid: string): boolean {
  return (
    insightsCache != null &&
    insightsCache.uid === uid &&
    Date.now() - insightsCache.ts < INSIGHTS_CACHE_TTL_MS
  );
}

/** Card header that links through to the page where the data is tracked. */
function LinkedTitle({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between"
      title={`Open ${href}`}
    >
      <CardTitle className="text-base">{title}</CardTitle>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

/** Compact, sized-to-fit empty state for chart cards — never a blank box. */
function ChartEmpty({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        {cta}
      </Link>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [data, setData] = useState<InsightsData | null>(
    user && cacheValid(user.uid) ? insightsCache!.data : null
  );
  const loading = data == null;

  const load = useCallback(async () => {
    if (!user) return;
    // Serve from the session cache when still fresh.
    if (cacheValid(user.uid)) {
      setData(insightsCache!.data);
      return;
    }
    const [g, t, h, l, s, n, trk, trkLogs] = await Promise.all([
      getGoals(user.uid),
      getTasks(user.uid),
      getHabits(user.uid),
      getHabitLogs(user.uid),
      getSleepLogs(user.uid),
      getNutritionLogs(user.uid),
      getTrackers(user.uid),
      getTrackerLogs(user.uid),
    ]);
    const fresh: InsightsData = {
      goals: g,
      tasks: t,
      habits: h,
      logs: l,
      sleepLogs: s,
      nutritionLogs: n,
      trackers: trk,
      trackerLogs: trkLogs,
    };
    insightsCache = { uid: user.uid, data: fresh, ts: Date.now() };
    setData(fresh);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const {
    goals,
    tasks,
    habits,
    logs,
    sleepLogs,
    nutritionLogs,
    trackers,
    trackerLogs,
  } = data ?? EMPTY_DATA;

  const habitById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits]
  );

  const stats = useMemo(() => {
    const activeGoals = goals.filter((g) => g.status === "active");
    const avgProgress =
      activeGoals.length > 0
        ? Math.round(
            activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length
          )
        : 0;

    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const taskRate =
      tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

    // Habit completions in the last 7 days ÷ (habits × 7), honoring
    // count/duration targets (a partial log isn't a completion).
    const weekKeys = new Set(
      Array.from({ length: 7 }, (_, i) => addDays(today, -i))
    );
    const weekCompletions = logs.filter((l) => {
      if (!weekKeys.has(l.completedDate)) return false;
      const habit = habitById.get(l.habitId);
      return habit ? isLogDone(habit, l) : false;
    }).length;
    const habitRate =
      habits.length > 0
        ? Math.round((weekCompletions / (habits.length * 7)) * 100)
        : 0;

    const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);

    const weekCutoff = addDays(today, -6);
    const recentSleep = sleepLogs.filter((s) => s.date >= weekCutoff);
    const avgSleep = averageHours(recentSleep);

    const recentNutrition = nutritionLogs.filter((n) => n.date >= weekCutoff);
    const avgWater =
      recentNutrition.length > 0
        ? recentNutrition.reduce((s, n) => s + n.water, 0) /
          recentNutrition.length
        : 0;

    return {
      activeGoals: activeGoals.length,
      avgProgress,
      doneTasks,
      totalTasks: tasks.length,
      taskRate,
      habitRate,
      bestStreak,
      avgSleep,
      avgWater,
    };
  }, [goals, tasks, habits, habitById, logs, sleepLogs, nutritionLogs, today]);

  // Only render stat tiles with real data — zeros/dashes don't get equal
  // visual weight to populated stats.
  const statTiles = useMemo(() => {
    const tiles: {
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      value: string;
      sub?: string;
    }[] = [];
    if (stats.activeGoals > 0)
      tiles.push({
        icon: Target,
        label: "Avg goal progress",
        value: `${stats.avgProgress}%`,
        sub: `${stats.activeGoals} active goals`,
      });
    if (stats.totalTasks > 0)
      tiles.push({
        icon: CheckCircle2,
        label: "Task completion",
        value: `${stats.taskRate}%`,
        sub: `${stats.doneTasks}/${stats.totalTasks} done`,
      });
    if (habits.length > 0)
      tiles.push({
        icon: TrendingUp,
        label: "Habits this week",
        value: `${stats.habitRate}%`,
        sub: "of possible check-ins",
      });
    if (stats.bestStreak > 0)
      tiles.push({
        icon: Flame,
        label: "Best streak",
        value: `${stats.bestStreak}d`,
      });
    if (stats.avgSleep > 0)
      tiles.push({
        icon: Moon,
        label: "Avg sleep (7d)",
        value: formatHours(stats.avgSleep),
      });
    if (stats.avgWater > 0)
      tiles.push({
        icon: GlassWater,
        label: "Avg water (7d)",
        value: `${Math.round(stats.avgWater * 10) / 10}`,
      });
    return tiles;
  }, [stats, habits.length]);

  const last14 = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i)),
    [today]
  );

  // Sleep hours per night, last 14 days.
  const sleepBars = useMemo(() => {
    const byDate = new Map(sleepLogs.map((s) => [s.date, s.hours]));
    return last14.map((d) => {
      const hours = byDate.get(d) ?? 0;
      return {
        date: d,
        hours,
        pct: Math.round((Math.min(hours, 10) / 10) * 100),
      };
    });
  }, [sleepLogs, last14]);

  // Tasks completed per day, last 14 days.
  const taskBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === "done" && t.completedAt) {
        const key = toDateKey(new Date(t.completedAt));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...last14.map((d) => counts.get(d) ?? 0));
    return last14.map((d) => ({
      date: d,
      count: counts.get(d) ?? 0,
      pct: Math.round(((counts.get(d) ?? 0) / max) * 100),
    }));
  }, [tasks, last14]);

  const hasTaskData = taskBars.some((b) => b.count > 0);

  // Habit completions per date for the heatmap (done-semantics).
  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of logs) {
      const habit = habitById.get(l.habitId);
      if (!habit || !isLogDone(habit, l)) continue;
      map[l.completedDate] = (map[l.completedDate] ?? 0) + 1;
    }
    return map;
  }, [logs, habitById]);

  // Per-tracker 14-day bars (custom trackers are equal citizens here).
  const activeTrackers = trackers.filter((t) => !t.archived);
  const trackerBars = useMemo(() => {
    const byTracker = new Map<string, Map<string, number>>();
    for (const l of trackerLogs) {
      if (!byTracker.has(l.trackerId)) byTracker.set(l.trackerId, new Map());
      byTracker.get(l.trackerId)!.set(l.date, l.value);
    }
    return activeTrackers.map((t) => {
      const values = byTracker.get(t.id) ?? new Map<string, number>();
      const max = Math.max(1, t.target ?? 0, ...Array.from(values.values()));
      return {
        tracker: t,
        hasData: values.size > 0,
        bars: last14.map((d) => {
          const v = values.get(d) ?? 0;
          return { date: d, value: v, pct: Math.round((v / max) * 100) };
        }),
      };
    });
  }, [activeTrackers, trackerLogs, last14]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Insights</h1>
          <p className="text-muted-foreground">
            How your goals, tasks, and habits are trending.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Insights</h1>
        <p className="text-muted-foreground">
          How your goals, tasks, and habits are trending.
        </p>
      </div>

      {/* Stat cards — only populated ones render */}
      {statTiles.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Your stats will show up here once you&apos;ve logged a few days.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statTiles.map((t) => (
            <StatCard key={t.label} {...t} />
          ))}
        </div>
      )}

      {/* Tasks completed chart */}
      <Card>
        <CardHeader>
          <LinkedTitle title="Tasks completed · last 14 days" href="/tasks" />
        </CardHeader>
        <CardContent>
          {!hasTaskData ? (
            <ChartEmpty
              message="No tasks completed in the last 14 days."
              href="/tasks"
              cta="Open tasks"
            />
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {taskBars.map((b) => (
                <div
                  key={b.date}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${b.date}: ${b.count} completed`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary",
                      b.count === 0 && "bg-muted"
                    )}
                    style={{ height: `${Math.max(b.pct, b.count > 0 ? 8 : 3)}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sleep chart */}
      <Card>
        <CardHeader>
          <LinkedTitle title="Sleep · last 14 nights" href="/sleep" />
        </CardHeader>
        <CardContent>
          {sleepLogs.length === 0 ? (
            <ChartEmpty
              message="Log your sleep to see the trend here."
              href="/sleep"
              cta="Log sleep"
            />
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {sleepBars.map((b) => (
                <div
                  key={b.date}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${b.date}: ${b.hours > 0 ? formatHours(b.hours) : "no data"}`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      b.hours === 0
                        ? "bg-muted"
                        : b.hours >= 7
                          ? "bg-emerald-500/80 group-hover:bg-emerald-500"
                          : b.hours >= 6
                            ? "bg-amber-500/80 group-hover:bg-amber-500"
                            : "bg-destructive/80 group-hover:bg-destructive"
                    )}
                    style={{ height: `${Math.max(b.pct, b.hours > 0 ? 8 : 3)}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom tracker charts — same treatment as built-ins */}
      {trackerBars.map(({ tracker, hasData, bars }) => {
        const Icon = trackerIcon(tracker.icon);
        return (
          <Card key={tracker.id}>
            <CardHeader>
              <LinkedTitle
                title={`${tracker.name} · last 14 days`}
                href="/trackers"
              />
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <ChartEmpty
                  message={`Log ${tracker.name} to see the trend here.`}
                  href="/trackers"
                  cta="Open trackers"
                />
              ) : (
                <>
                  <div className="flex h-28 items-end gap-1.5">
                    {bars.map((b) => (
                      <div
                        key={b.date}
                        className="group flex flex-1 flex-col items-center justify-end gap-1"
                        title={`${b.date}: ${formatTrackerValue(tracker, b.value)}`}
                      >
                        <div
                          className={cn(
                            "w-full rounded-t transition-all",
                            b.value === 0
                              ? "bg-muted"
                              : "bg-primary/80 group-hover:bg-primary"
                          )}
                          style={{
                            height: `${Math.max(b.pct, b.value > 0 ? 8 : 3)}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {tracker.target != null && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      Daily target: {formatTrackerValue(tracker, tracker.target)}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Habit heatmap */}
      <Card>
        <CardHeader>
          <LinkedTitle title="Habit consistency" href="/habits" />
        </CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <ChartEmpty
              message="Add habits to see your consistency heatmap."
              href="/habits"
              cta="Open habits"
            />
          ) : (
            <HabitHeatmap
              countsByDate={countsByDate}
              max={habits.length}
              today={today}
            />
          )}
        </CardContent>
      </Card>

      {/* Goal progress */}
      <Card>
        <CardHeader>
          <LinkedTitle title="Goal progress" href="/goals" />
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.length === 0 ? (
            <ChartEmpty
              message="No goals yet — progress bars will appear here."
              href="/goals"
              cta="Add a goal"
            />
          ) : (
            goals.map((g) => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="font-medium">
                    {g.progressType === "count" && g.targetValue
                      ? `${g.currentValue ?? 0}/${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`
                      : `${g.progress}%`}
                  </span>
                </div>
                <Progress value={g.progress} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
