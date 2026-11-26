"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks, Timer } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PlanTaskRow } from "@/components/planner/plan-task-row";
import { getSessions, getTasks } from "@/lib/firebase/db";
import { addDays } from "@/lib/habits";
import { minutesLabel, weekReview } from "@/lib/planner";
import { usePlannerActions } from "@/lib/use-planner-actions";
import type { Goal, Session, Task } from "@/lib/types";

interface Props {
  /** Monday key of the week being reviewed. */
  weekStart: string;
  today: string;
  goals: Goal[];
}

/**
 * The planner's part of the weekly review: what got done, how much time went
 * in, what slipped — and one button to carry the slipped tasks into next week.
 */
export function WeekPlanReview({ weekStart, today, goals }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setTasks(await getTasks(user.uid));
      setState("ready");
    } catch {
      setState("error");
    }
    try {
      setSessions(await getSessions(user.uid));
    } catch {
      /* optional */
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const goalFor = useCallback(
    (task: Task) => (task.goalId ? goalsById.get(task.goalId) : null),
    [goalsById]
  );
  const refresh = useCallback(() => void load(), [load]);
  const actions = usePlannerActions({ mutate: setTasks, refresh, goalFor });

  const live = useMemo(
    () =>
      tasks.filter((t) => {
        const g = t.goalId ? goalsById.get(t.goalId) : null;
        return !g || (g.status !== "paused" && g.status !== "archived");
      }),
    [tasks, goalsById]
  );
  const review = useMemo(
    () => weekReview(live, sessions, weekStart, today),
    [live, sessions, weekStart, today]
  );
  const nextMonday = addDays(weekStart, 7) > today ? addDays(weekStart, 7) : today;

  if (state === "loading") return null;
  if (state === "error")
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4 text-sm" role="alert">
          <span className="text-muted-foreground">Couldn&apos;t load this week&apos;s tasks.</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  const byGoal = new Map<string, number>();
  for (const t of review.done) {
    const title = goalFor(t)?.title ?? "No goal";
    byGoal.set(title, (byGoal.get(title) ?? 0) + 1);
  }

  return (
    <section className="space-y-3" aria-label="This week's plan">
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={CheckCircle2} label="Tasks done" value={review.done.length} tone={review.done.length > 0 ? "emerald" : "default"} />
        <StatTile icon={AlertTriangle} label="Slipped" value={review.slipped.length} tone={review.slipped.length > 0 ? "amber" : "default"} />
        <StatTile icon={Timer} label="Time spent" value={minutesLabel(review.spentMin) || "0m"} />
      </div>

      {review.done.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          {Array.from(byGoal.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([title, n]) => `${title}: ${n}`)
            .join(" · ")}
        </p>
      )}

      {review.slipped.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm">Slipped · {review.slipped.length}</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                void actions.rescheduleMany(
                  review.slipped.map((task) => ({ task, date: nextMonday })),
                  `Moved ${review.slipped.length} ${
                    review.slipped.length === 1 ? "task" : "tasks"
                  } to ${nextMonday === today ? "today" : "next Monday"}`
                )
              }
            >
              <ArrowRight className="h-4 w-4" />
              Move all to {nextMonday === today ? "today" : "next week"}
            </Button>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {review.slipped.map((t) => (
              <PlanTaskRow
                key={t.id}
                task={t}
                goal={goalFor(t)}
                showGoalDot
                context={goalFor(t)?.title ?? null}
                today={today}
                onToggleDone={actions.toggleDone}
                onReschedule={actions.reschedule}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
