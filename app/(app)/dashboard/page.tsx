"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Flame,
  TrendingUp,
  CheckCircle2,
  ListTodo,
  Plus,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getActiveGoals,
  getDailyHabits,
  getHabitLogs,
  getTasks,
  toggleHabitLog,
} from "@/lib/firebase/db";
import { greetingFor, nameFromEmail, toDateKey } from "@/lib/greeting";
import { habitStateFromDates } from "@/lib/habits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitRow } from "@/components/habits/habit-row";
import type { Goal, Habit, Task } from "@/lib/types";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
        </div>
      </CardContent>
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
  const [loading, setLoading] = useState(true);

  const today = toDateKey(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [g, h, t, logs] = await Promise.all([
        getActiveGoals(user.uid),
        getDailyHabits(user.uid),
        getTasks(user.uid),
        getHabitLogs(user.uid),
      ]);
      const byHabit: Record<string, string[]> = {};
      for (const log of logs) {
        (byHabit[log.habitId] ??= []).push(log.completedDate);
      }
      setGoals(g);
      setHabits(h);
      setTasks(t);
      setLogDatesByHabit(byHabit);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Top open tasks: due first (soonest, incl. overdue), then by priority.
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

  const greeting = greetingFor(new Date().getHours());
  const name = nameFromEmail(user?.email);

  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length)
      : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak ?? 0), 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">
          🌅 {greeting}, {name}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what matters today. Let&apos;s make it count.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Active goals" value={String(goals.length)} />
        <StatCard
          icon={TrendingUp}
          label="Avg goal progress"
          value={`${avgProgress}%`}
        />
        <StatCard icon={Flame} label="Best streak" value={`${bestStreak}d`} />
      </div>

      {/* Active goals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> Active Goals
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/goals">View all</Link>
          </Button>
        </div>

        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Target className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No active goals yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Focus on just 3 goals at a time. Add your first one to start
                breaking it into projects and daily tasks.
              </p>
              <Button asChild>
                <Link href="/goals">
                  <Plus className="h-4 w-4" /> Add a goal
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-medium text-foreground">
                      {goal.progress ?? 0}%
                    </span>
                  </div>
                  <Progress value={goal.progress ?? 0} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Today's Focus */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ListTodo className="h-5 w-5 text-primary" /> Today&apos;s Focus
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tasks">View tasks</Link>
          </Button>
        </div>
        {focusTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <ListTodo className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">You&apos;re all caught up</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                No open tasks. Add tasks to your goals or a quick one from the
                Tasks page.
              </p>
              <Button asChild>
                <Link href="/tasks">
                  <Plus className="h-4 w-4" /> Add a task
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {focusTasks.map((t) => (
                <TaskRow key={t.id} task={t} onChanged={load} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Habits */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Flame className="h-5 w-5 text-primary" /> Today&apos;s Habits
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/habits">Manage</Link>
          </Button>
        </div>

        {habits.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No habits tracked yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Build momentum with daily streaks — vitamins, Spanish, workout,
                and more.
              </p>
              <Button asChild>
                <Link href="/habits">
                  <Plus className="h-4 w-4" /> Add a habit
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {habits.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  state={habitStateFromDates(
                    logDatesByHabit[h.id] ?? [],
                    today
                  )}
                  onToggle={(done) => handleHabitToggle(h.id, done)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
