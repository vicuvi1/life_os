"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ListChecks,
  Pause,
  Play,
  Target,
  Timer,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NumberField } from "@/components/ui/number-field";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { LoadError } from "@/components/planner/load-error";
import { TimeHeatmap } from "@/components/planner/time-heatmap";
import { YearRoadmap } from "@/components/planner/year-roadmap";
import { useToast } from "@/components/toast/toast-provider";
import {
  getGoals,
  getPrefs,
  getSessions,
  getTasks,
  updateGoal,
  upsertPrefs,
} from "@/lib/firebase/db";
import { formatMonthYear } from "@/lib/dates";
import { toDateKey } from "@/lib/greeting";
import {
  DEFAULT_DAILY_LIMIT_MIN,
  goalHealth,
  goalOverlaps,
  minutesLabel,
  quarterOf,
  spentByDate,
  sumRange,
} from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Goal, Session, Task } from "@/lib/types";

const ALL = "__all__";
const FOCUS_LIMIT = 3;
const pad = (n: number) => String(n).padStart(2, "0");

export default function YearPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = toDateKey(new Date());
  const thisYear = Number(today.slice(0, 4));

  const [year, setYear] = useState(thisYear);
  const [monthIdx, setMonthIdx] = useState(Number(today.slice(5, 7)) - 1);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [limitMin, setLimitMin] = useState(DEFAULT_DAILY_LIMIT_MIN);
  const [monthPlans, setMonthPlans] = useState<Record<string, Record<string, number>>>({});
  const [heatGoal, setHeatGoal] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const [g, t] = await Promise.all([getGoals(user.uid), getTasks(user.uid)]);
        setGoals(g);
        setTasks(t);
        setLoadError(false);
      } catch (err) {
        console.error("Year view failed to load:", err);
        if (!silent) setLoadError(true);
      } finally {
        if (!silent) setLoading(false);
      }
      try {
        setSessions(await getSessions(user.uid));
      } catch {
        /* time from sessions is optional */
      }
      try {
        const prefs = await getPrefs(user.uid);
        setLimitMin(prefs.dailyLimitMin);
        setMonthPlans(prefs.monthPlans);
      } catch {
        /* keep defaults */
      }
    },
    [user]
  );
  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => goals.filter((g) => g.status !== "archived"), [goals]);
  const healthById = useMemo(
    () => new Map(goals.map((g) => [g.id, goalHealth(g, tasks, today)])),
    [goals, tasks, today]
  );

  // --- Year totals -------------------------------------------------------
  const allSpent = useMemo(() => spentByDate(tasks, sessions), [tasks, sessions]);
  const yearSpent = sumRange(allSpent, `${year}-01-01`, `${year}-12-31`);
  const doneThisYear = tasks.filter((t) => {
    if (t.status !== "done") return false;
    const when = t.completedAt ? toDateKey(new Date(t.completedAt)) : t.dueDate;
    return when != null && when.slice(0, 4) === String(year);
  }).length;

  // --- Quarter focus -----------------------------------------------------
  const quarter = quarterOf(year === thisYear ? today : `${year}-01-01`);
  const quarterGoals = visible.filter(
    (g) =>
      (g.status === "active" || g.status === "paused") &&
      goalOverlaps(g, quarter.start, quarter.end, today)
  );
  const activeInQuarter = quarterGoals.filter((g) => g.status === "active");
  const overFocus = activeInQuarter.length > FOCUS_LIMIT;

  async function setParked(goal: Goal, parked: boolean) {
    const status = parked ? "paused" : "active";
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status } : g)));
    try {
      await updateGoal(goal.id, { status });
      toast({
        message: parked
          ? `Parked “${goal.title}” — its tasks are hidden from Today and the calendar`
          : `Resumed “${goal.title}”`,
        tone: "success",
      });
    } catch {
      toast({ message: "Couldn't update the goal. Try again.", tone: "error" });
      void load(true);
    }
  }

  // --- Month plan --------------------------------------------------------
  const monthKey = `${year}-${pad(monthIdx + 1)}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${pad(new Date(year, monthIdx + 1, 0).getDate())}`;
  const monthGoals = visible.filter(
    (g) => g.status === "active" && goalOverlaps(g, monthStart, monthEnd, today)
  );
  const plan = monthPlans[monthKey] ?? {};
  const plannedTotal = monthGoals.reduce((s, g) => s + (plan[g.id] ?? 0), 0);
  const capacityHours = Math.round(
    (limitMin * new Date(year, monthIdx + 1, 0).getDate()) / 60
  );
  const actualByGoal = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of monthGoals)
      map.set(g.id, sumRange(spentByDate(tasks, sessions, g.id), monthStart, monthEnd));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sessions, monthKey, goals]);

  async function setPlannedHours(goalId: string, hours: number) {
    if (!user) return;
    const nextMonth = { ...plan, [goalId]: Math.max(0, hours) };
    const next = { ...monthPlans, [monthKey]: nextMonth };
    setMonthPlans(next);
    try {
      await upsertPrefs(user.uid, { monthPlans: next });
    } catch {
      toast({ message: "Couldn't save the month plan. Try again.", tone: "error" });
    }
  }

  // --- Heatmap -----------------------------------------------------------
  const heatData = useMemo(
    () => (heatGoal === ALL ? allSpent : spentByDate(tasks, sessions, heatGoal)),
    [heatGoal, allSpent, tasks, sessions]
  );
  const heatColor = goals.find((g) => g.id === heatGoal)?.color ?? "#8b5cf6";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Year" description="The long view: every goal, start to deadline.">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center font-semibold tabular-nums">{year}</span>
          <Button variant="outline" size="icon" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      ) : loadError ? (
        <LoadError title="Couldn't load the year view" onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals to plan yet"
          description="Add a goal with a start date and a deadline and it appears here as a bar across the year."
          action={
            <Button asChild>
              <Link href="/goals">Add a goal</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={Target}
              label="Active goals"
              value={visible.filter((g) => g.status === "active").length}
            />
            <StatTile
              icon={AlertTriangle}
              label="Behind"
              value={
                visible.filter(
                  (g) => g.status === "active" && healthById.get(g.id)?.status === "behind"
                ).length
              }
            />
            <StatTile icon={ListChecks} label={`Tasks done in ${year}`} value={doneThisYear} />
            <StatTile icon={Timer} label={`Time spent in ${year}`} value={minutesLabel(yearSpent) || "0m"} />
          </div>

          <section className="space-y-2" aria-labelledby="roadmap-heading">
            <h2 id="roadmap-heading" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CalendarRange className="h-4 w-4" /> Roadmap
              <span className="text-xs font-normal">· bars run start → deadline, ◆ are milestones</span>
            </h2>
            <YearRoadmap year={year} goals={visible} today={today} healthById={healthById} />
          </section>

          {/* Quarter focus */}
          <Card className={cn(overFocus && "border-amber-500/40")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Crosshair className="h-4 w-4 text-muted-foreground" /> Focus for {quarter.label}
                <span
                  className={cn(
                    "text-xs font-normal text-muted-foreground",
                    overFocus && "font-medium text-amber-600 dark:text-amber-400"
                  )}
                >
                  · {activeInQuarter.length} active
                  {overFocus && ` — more than ${FOCUS_LIMIT} spreads you thin`}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Keep two or three goals active per quarter and park the rest. Parked goals keep
                their plan but stay off Today and the calendar.
              </p>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {quarterGoals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No goals run during this quarter.</p>
              ) : (
                quarterGoals.map((g) => {
                  const parked = g.status === "paused";
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: g.color ?? "hsl(var(--muted-foreground))" }}
                      />
                      <Link
                        href={`/goals/${g.id}`}
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm hover:underline",
                          parked && "text-muted-foreground"
                        )}
                      >
                        {g.icon ? `${g.icon} ` : ""}
                        {g.title}
                        {parked && " · parked"}
                      </Link>
                      <Button size="sm" variant={parked ? "outline" : "ghost"} onClick={() => void setParked(g, !parked)}>
                        {parked ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        {parked ? "Resume" : "Park"}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Month plan */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Month plan</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Previous month"
                    disabled={monthIdx === 0}
                    onClick={() => setMonthIdx((m) => Math.max(0, m - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-36 text-center text-sm font-medium">
                    {formatMonthYear(year, monthIdx)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Next month"
                    disabled={monthIdx === 11}
                    onClick={() => setMonthIdx((m) => Math.min(11, m + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Decide how many hours each goal gets this month, then compare with the time you
                actually logged. Planned {plannedTotal}h of about {capacityHours}h available at your
                daily limit.
                {plannedTotal > capacityHours && (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {" "}
                    That is more than fits.
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {monthGoals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No active goals run during this month.</p>
              ) : (
                monthGoals.map((g) => {
                  const planned = plan[g.id] ?? 0;
                  const actualMin = actualByGoal.get(g.id) ?? 0;
                  const pct = planned > 0 ? Math.min(100, Math.round((actualMin / 60 / planned) * 100)) : 0;
                  return (
                    <div key={g.id} className="space-y-1.5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color ?? "hsl(var(--muted-foreground))" }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {g.icon ? `${g.icon} ` : ""}
                          {g.title}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {minutesLabel(actualMin) || "0m"} logged of
                        </span>
                        <NumberField
                          value={planned}
                          onCommit={(v) => void setPlannedHours(g.id, v)}
                          min={0}
                          max={744}
                          suffix="h"
                          inputClassName="w-16"
                          aria-label={`Planned hours for ${g.title}`}
                        />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: g.color ?? "hsl(var(--primary))" }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Time spent, day by day</CardTitle>
                <select
                  value={heatGoal}
                  onChange={(e) => setHeatGoal(e.target.value)}
                  aria-label="Goal to show"
                  className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={ALL}>All goals</option>
                  {visible.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                From task timers and completed sessions linked to a goal.
              </p>
            </CardHeader>
            <CardContent>
              <TimeHeatmap year={year} minutesByDate={heatData} color={heatColor} today={today} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
