"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Minus,
  Bell,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getActiveGoals,
  getDailyHabits,
  getHabitLogs,
  getNutritionLog,
  getSessionsInRange,
  getSleepLogs,
  getTasks,
  toggleHabitLog,
  upsertNutritionLog,
} from "@/lib/firebase/db";
import { greetingFor, nameFromEmail, toDateKey } from "@/lib/greeting";
import { habitStateFromDates } from "@/lib/habits";
import { sessionColor, rangeLabel } from "@/lib/sessions";
import { formatHours } from "@/lib/sleep";
import { DEFAULT_WATER_TARGET, hydrationRating } from "@/lib/nutrition";
import { buildNudges } from "@/lib/nudges";
import { currentPermission, showNotification } from "@/lib/notify";
import {
  EMOJI,
  greetingEmoji,
  GOAL_CATEGORY_EMOJI,
  HABIT_CATEGORY_EMOJI,
} from "@/lib/emoji";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/collapsible-section";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitRow } from "@/components/habits/habit-row";
import { cn } from "@/lib/utils";
import type { Goal, Habit, Session, SleepLog, Task } from "@/lib/types";

function StatTile({
  emoji,
  label,
  value,
  children,
}: {
  emoji: string;
  label: string;
  value: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(children);
  return (
    <Card className="card-interactive">
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-3 p-4">
          <span className="text-xl leading-none">{emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          {expandable && (
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          )}
        </div>
      </button>
      {open && expandable && (
        <div className="border-t px-4 py-3 text-sm">{children}</div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logDatesByHabit, setLogDatesByHabit] = useState<
    Record<string, string[]>
  >({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [water, setWater] = useState(0);
  const [waterTarget, setWaterTarget] = useState(DEFAULT_WATER_TARGET);
  const [loading, setLoading] = useState(true);
  const waterRef = useRef(0);

  const today = toDateKey(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [g, h, t, logs, sess, sleep, nutrition] = await Promise.all([
        getActiveGoals(user.uid),
        getDailyHabits(user.uid),
        getTasks(user.uid),
        getHabitLogs(user.uid),
        getSessionsInRange(user.uid, today, today),
        getSleepLogs(user.uid),
        getNutritionLog(user.uid, today),
      ]);
      const byHabit: Record<string, string[]> = {};
      for (const log of logs) {
        (byHabit[log.habitId] ??= []).push(log.completedDate);
      }
      setGoals(g);
      setHabits(h);
      setTasks(t);
      setLogDatesByHabit(byHabit);
      setSessions(sess);
      setSleepLogs(sleep);
      setWater(nutrition?.water ?? 0);
      waterRef.current = nutrition?.water ?? 0;
      setWaterTarget(nutrition?.waterTarget ?? DEFAULT_WATER_TARGET);
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  async function adjustWater(delta: number) {
    if (!user) return;
    const prev = waterRef.current;
    const next = Math.max(0, prev + delta);
    waterRef.current = next;
    setWater(next);
    try {
      await upsertNutritionLog(user.uid, today, { water: next });
    } catch {
      waterRef.current = prev;
      setWater(prev);
    }
  }

  async function handleHabitToggle(habitId: string, done: boolean) {
    if (!user) return;
    setLogDatesByHabit((prev) => {
      const dates = new Set(prev[habitId] ?? []);
      if (done) dates.add(today);
      else dates.delete(today);
      return { ...prev, [habitId]: Array.from(dates) };
    });
    await toggleHabitLog(user.uid, habitId, today, done);
    setHabits(await getDailyHabits(user.uid));
  }

  const greeting = greetingFor(new Date().getHours());
  const name = nameFromEmail(user?.email);

  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length)
      : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak ?? 0), 0);
  const lastNight = sleepLogs[0];
  const habitsDoneToday = habits.filter((h) =>
    (logDatesByHabit[h.id] ?? []).includes(today)
  ).length;

  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const focusTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    })
    .slice(0, 6);

  const nudges = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const next = [...sessions]
      .filter((s) => s.status === "planned" && s.startMin >= nowMinutes)
      .sort((a, b) => a.startMin - b.startMin)[0];
    return buildNudges({
      nowMinutes,
      sleepLoggedToday: sleepLogs.some((s) => s.date === today),
      water,
      waterTarget,
      habitsDone: habitsDoneToday,
      habitsTotal: habits.length,
      tasksDueTodayOpen: tasks.filter(
        (t) => t.dueDate === today && t.status !== "done"
      ).length,
      nextSession: next ? { title: next.title, startMin: next.startMin } : null,
    });
  }, [
    habits.length,
    habitsDoneToday,
    sessions,
    sleepLogs,
    tasks,
    water,
    waterTarget,
    today,
  ]);

  useEffect(() => {
    if (loading || nudges.length === 0) return;
    if (currentPermission() !== "granted") return;
    const key = "lifeos:nudgeNotified";
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      return;
    }
    const top = nudges[0];
    showNotification(
      "Life OS — today",
      top.detail ? `${top.title} · ${top.detail}` : top.title
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, today]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hydration = hydrationRating(water, waterTarget);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Greeting */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/12 via-card to-card p-6 md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          {greetingEmoji(new Date().getHours())} {greeting}, {name}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what matters today. Let&apos;s make it count.
        </p>
      </div>

      {/* Needs your attention */}
      {nudges.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Needs your attention</span>
            </div>
            <div className="divide-y">
              {nudges.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      n.tone === "warning" ? "bg-amber-500" : "bg-primary"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.detail && (
                      <p className="text-xs text-muted-foreground">{n.detail}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expandable stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile emoji={EMOJI.goals} label="Active goals" value={String(goals.length)}>
          {goals.length === 0 ? (
            <p className="text-muted-foreground">
              No active goals.{" "}
              <Link href="/goals" className="text-primary hover:underline">
                Add one
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span>
                    {g.category ? GOAL_CATEGORY_EMOJI[g.category] : "🎯"}
                  </span>
                  <span className="flex-1 truncate">{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </StatTile>

        <StatTile
          emoji={EMOJI.progress}
          label="Avg progress"
          value={`${avgProgress}%`}
        >
          {goals.length === 0 ? (
            <p className="text-muted-foreground">No goals yet.</p>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{g.title}</span>
                    <span className="text-muted-foreground">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                </div>
              ))}
            </div>
          )}
        </StatTile>

        <StatTile emoji={EMOJI.streak} label="Best streak" value={`${bestStreak}d`}>
          {habits.length === 0 ? (
            <p className="text-muted-foreground">No habits yet.</p>
          ) : (
            <div className="space-y-1.5">
              {[...habits]
                .sort((a, b) => (b.bestStreak ?? 0) - (a.bestStreak ?? 0))
                .slice(0, 6)
                .map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span>
                      {h.category ? HABIT_CATEGORY_EMOJI[h.category] : "🔥"}
                    </span>
                    <span className="flex-1 truncate">{h.title}</span>
                    <span className="text-muted-foreground">
                      {h.bestStreak}d
                    </span>
                  </div>
                ))}
            </div>
          )}
        </StatTile>

        <StatTile
          emoji={EMOJI.sleep}
          label="Last night"
          value={lastNight ? formatHours(lastNight.hours) : "—"}
        >
          {sleepLogs.length === 0 ? (
            <p className="text-muted-foreground">
              No sleep logged.{" "}
              <Link href="/sleep" className="text-primary hover:underline">
                Log it
              </Link>
            </p>
          ) : (
            <div className="space-y-1.5">
              {sleepLogs.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-muted-foreground">
                    {s.date}
                  </span>
                  <span>{formatHours(s.hours)}</span>
                  <span className="text-muted-foreground">· {s.quality}/10</span>
                </div>
              ))}
            </div>
          )}
        </StatTile>
      </div>

      {/* Bento grid */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Today's Focus */}
        <CollapsibleSection
          id="focus"
          emoji={EMOJI.focus}
          title="Today's Focus"
          count={focusTasks.length || undefined}
          className="lg:col-span-2"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">View tasks</Link>
            </Button>
          }
        >
          {focusTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                No open tasks. Add one to keep momentum.
              </p>
              <Button asChild size="sm">
                <Link href="/tasks">
                  <Plus className="h-4 w-4" /> Add a task
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {focusTasks.map((t) => (
                <TaskRow key={t.id} task={t} onChanged={load} />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Water widget (compact) */}
        <Card className="card-interactive lg:col-span-1">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {EMOJI.water} Water
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {hydration.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold">
                {water}
                <span className="text-base text-muted-foreground">
                  {" "}
                  / {waterTarget}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Remove a glass"
                  onClick={() => adjustWater(-1)}
                  disabled={water <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  aria-label="Add a glass"
                  onClick={() => adjustWater(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Goals */}
        <CollapsibleSection
          id="goals"
          emoji={EMOJI.goals}
          title="Active Goals"
          count={goals.length || undefined}
          className="lg:col-span-2"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/goals">View all</Link>
            </Button>
          }
        >
          {goals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm font-medium">No active goals yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Focus on just 3 goals at a time.
              </p>
              <Button asChild size="sm">
                <Link href="/goals">
                  <Plus className="h-4 w-4" /> Add a goal
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => (
                <Link
                  key={goal.id}
                  href={`/goals/${goal.id}`}
                  className="card-interactive rounded-xl border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span>
                      {goal.category ? GOAL_CATEGORY_EMOJI[goal.category] : "🎯"}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {goal.title}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-medium text-foreground">
                      {goal.progress}%
                    </span>
                  </div>
                  <Progress value={goal.progress} className="mt-1" />
                </Link>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Habits */}
        <CollapsibleSection
          id="habits"
          emoji={EMOJI.habits}
          title="Habits"
          count={habits.length ? `${habitsDoneToday}/${habits.length}` : undefined}
          className="lg:col-span-1"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/habits">Manage</Link>
            </Button>
          }
        >
          {habits.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm font-medium">No habits yet</p>
              <Button asChild size="sm">
                <Link href="/habits">
                  <Plus className="h-4 w-4" /> Add a habit
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {habits.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  state={habitStateFromDates(
                    logDatesByHabit[h.id] ?? [],
                    today
                  )}
                  onToggle={(done) => handleHabitToggle(h.id, done)}
                  showWeek={false}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Today's Schedule */}
        {sessions.length > 0 && (
          <CollapsibleSection
            id="schedule"
            emoji={EMOJI.schedule}
            title="Today's Schedule"
            count={sessions.length}
            className="lg:col-span-3"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/sessions">Plan</Link>
              </Button>
            }
          >
            <div className="divide-y rounded-lg border">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sessionColor(s) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        s.status === "skipped" &&
                          "text-muted-foreground line-through"
                      )}
                    >
                      {s.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rangeLabel(s.startMin, s.endMin)}
                    </p>
                  </div>
                  {s.status === "done" && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      {s.quality != null ? `${s.quality}/10` : "Done"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
