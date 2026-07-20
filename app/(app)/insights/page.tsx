"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  CheckCircle2,
  Flame,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoals,
  getTasks,
  getHabits,
  getHabitLogs,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HabitHeatmap } from "@/components/insights/habit-heatmap";
import { cn } from "@/lib/utils";
import type { Goal, Habit, HabitLog, Task } from "@/lib/types";

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

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [g, t, h, l] = await Promise.all([
        getGoals(user.uid),
        getTasks(user.uid),
        getHabits(user.uid),
        getHabitLogs(user.uid),
      ]);
      setGoals(g);
      setTasks(t);
      setHabits(h);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

    // Habit completions in the last 7 days ÷ (habits × 7).
    const weekKeys = new Set(
      Array.from({ length: 7 }, (_, i) => addDays(today, -i))
    );
    const weekCompletions = logs.filter((l) =>
      weekKeys.has(l.completedDate)
    ).length;
    const habitRate =
      habits.length > 0
        ? Math.round((weekCompletions / (habits.length * 7)) * 100)
        : 0;

    const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);

    return {
      activeGoals: activeGoals.length,
      avgProgress,
      doneTasks,
      totalTasks: tasks.length,
      taskRate,
      habitRate,
      bestStreak,
    };
  }, [goals, tasks, habits, logs, today]);

  // Tasks completed per day, last 14 days.
  const taskBars = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === "done" && t.completedAt) {
        const key = toDateKey(new Date(t.completedAt));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...days.map((d) => counts.get(d) ?? 0));
    return days.map((d) => ({
      date: d,
      count: counts.get(d) ?? 0,
      pct: Math.round(((counts.get(d) ?? 0) / max) * 100),
    }));
  }, [tasks, today]);

  // Habit completions per date for the heatmap.
  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of logs) {
      map[l.completedDate] = (map[l.completedDate] ?? 0) + 1;
    }
    return map;
  }, [logs]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Avg goal progress"
          value={`${stats.avgProgress}%`}
          sub={`${stats.activeGoals} active goals`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Task completion"
          value={`${stats.taskRate}%`}
          sub={`${stats.doneTasks}/${stats.totalTasks} done`}
        />
        <StatCard
          icon={TrendingUp}
          label="Habits this week"
          value={`${stats.habitRate}%`}
          sub="of possible check-ins"
        />
        <StatCard
          icon={Flame}
          label="Best streak"
          value={`${stats.bestStreak}d`}
        />
      </div>

      {/* Tasks completed chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tasks completed · last 14 days
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Habit heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Habit consistency</CardTitle>
        </CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add habits to see your consistency heatmap.
            </p>
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
          <CardTitle className="text-base">Goal progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goals yet.</p>
          ) : (
            goals.map((g) => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="font-medium">{g.progress}%</span>
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
