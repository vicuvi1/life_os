"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Clock,
  ListChecks,
  Sun,
  Sunrise,
  Timer,
  Wand2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/planner/load-error";
import { PlanTaskRow } from "@/components/planner/plan-task-row";
import { TaskQuickAdd, type QuickAddValues } from "@/components/planner/task-quick-add";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { createTask, deleteTask, getGoals, getPrefs, getTasks } from "@/lib/firebase/db";
import { formatLongDate } from "@/lib/dates";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import {
  DEFAULT_DAILY_LIMIT_MIN,
  autoPlan,
  dayLoadMin,
  isOverLimit,
  isTaskDone,
  isTaskOverdue,
  isTaskUnscheduled,
  minutesLabel,
  sortPlanTasks,
  spentByDate,
} from "@/lib/planner";
import { deadlineWarning } from "@/lib/planner-actions";
import { usePlannerActions } from "@/lib/use-planner-actions";
import { cn } from "@/lib/utils";
import type { Goal, Task } from "@/lib/types";

const NO_GOAL = "__none__";

export default function TodayPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [today, setToday] = useState(() => toDateKey(new Date()));
  const tomorrow = addDays(today, 1);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [limitMin, setLimitMin] = useState(DEFAULT_DAILY_LIMIT_MIN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const [t, g] = await Promise.all([getTasks(user.uid), getGoals(user.uid)]);
        setTasks(t);
        setGoals(g);
        setLoadError(false);
      } catch (err) {
        console.error("Today failed to load:", err);
        if (!silent) setLoadError(true);
      } finally {
        if (!silent) setLoading(false);
      }
      // The limit is a nicety — never let it block the page.
      try {
        setLimitMin((await getPrefs(user.uid)).dailyLimitMin);
      } catch {
        /* keep the default */
      }
    },
    [user]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Roll over to the new day if the app stays open past midnight.
  useEffect(() => {
    const tick = () => setToday(toDateKey(new Date()));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const refresh = useCallback(() => void load(true), [load]);
  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const goalFor = useCallback(
    (task: Task) => (task.goalId ? goalsById.get(task.goalId) : null),
    [goalsById]
  );
  const actions = usePlannerActions({ mutate: setTasks, refresh, goalFor });

  // Tasks of paused / archived goals are parked — they don't nag on Today.
  const live = useMemo(
    () =>
      tasks.filter((t) => {
        const g = t.goalId ? goalsById.get(t.goalId) : null;
        return !g || (g.status !== "paused" && g.status !== "archived");
      }),
    [tasks, goalsById]
  );
  const overdue = useMemo(
    () => sortPlanTasks(live.filter((t) => isTaskOverdue(t, today))),
    [live, today]
  );
  const todays = useMemo(() => live.filter((t) => t.dueDate === today), [live, today]);
  const backlog = useMemo(() => live.filter(isTaskUnscheduled), [live]);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of todays) {
      const key = t.goalId && goalsById.has(t.goalId) ? t.goalId : NO_GOAL;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return Array.from(map.entries())
      .map(([key, list]) => ({
        key,
        goal: key === NO_GOAL ? null : goalsById.get(key) ?? null,
        tasks: sortPlanTasks(list),
      }))
      .sort((a, b) => {
        if (!a.goal) return 1;
        if (!b.goal) return -1;
        if (a.goal.focus !== b.goal.focus) return a.goal.focus ? -1 : 1;
        return (a.goal.deadline ?? "9999") < (b.goal.deadline ?? "9999") ? -1 : 1;
      });
  }, [todays, goalsById]);

  const doneCount = todays.filter(isTaskDone).length;
  const openToday = todays.filter((t) => !isTaskDone(t));
  const plannedMin = dayLoadMin(todays);
  const remainingMin = dayLoadMin(openToday);
  const over = isOverLimit(plannedMin, limitMin);
  const spentToday = useMemo(() => spentByDate(tasks).get(today) ?? 0, [tasks, today]);
  const activeGoals = useMemo(
    () =>
      goals
        .filter((g) => g.status === "active")
        .map((g) => ({ id: g.id, title: g.title, deadline: g.deadline })),
    [goals]
  );

  async function addTask(values: QuickAddValues) {
    if (!user) return;
    await createTask(user.uid, {
      title: values.title,
      description: null,
      priority: "medium",
      dueDate: values.dueDate,
      projectId: null,
      goalId: values.goalId,
      estimatedMinutes: values.estimatedMinutes,
    });
    const warning = deadlineWarning(
      values.dueDate,
      values.goalId ? goalsById.get(values.goalId) : null
    );
    if (warning) toast({ message: warning, duration: 6000 });
    refresh();
  }

  function runAutoPlan() {
    const placements = autoPlan(live, {
      from: today,
      limitMin,
      deadlines: new Map(goals.map((g) => [g.id, g.deadline])),
    });
    if (placements.length === 0) {
      toast({ message: "No room found in the next 60 days under your daily limit." });
      return;
    }
    const byId = new Map(live.map((t) => [t.id, t]));
    const moves = placements.flatMap((p) => {
      const task = byId.get(p.taskId);
      return task ? [{ task, date: p.date }] : [];
    });
    const left = backlog.length - moves.length;
    void actions.rescheduleMany(
      moves,
      `Planned ${moves.length} ${moves.length === 1 ? "task" : "tasks"}${
        left > 0 ? ` · ${left} didn't fit` : ""
      }`
    );
  }

  const rowProps = {
    today,
    onToggleDone: actions.toggleDone,
    onReschedule: actions.reschedule,
    onToggleTimer: actions.toggleTimer,
    onAddTime: actions.addTime,
    onEdit: setEditing,
    onDelete: setDeleting,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Today" description={formatLongDate(today)} />

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError ? (
        <LoadError title="Couldn't load today" onRetry={() => void load()} />
      ) : (
        <>
          {/* At a glance */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={ListChecks}
              label="Done today"
              value={`${doneCount}/${todays.length}`}
              tone={todays.length > 0 && doneCount === todays.length ? "emerald" : "default"}
            />
            <StatTile icon={Clock} label="Left to do" value={minutesLabel(remainingMin) || "0m"} />
            <StatTile
              icon={AlertTriangle}
              label={`Planned · limit ${minutesLabel(limitMin)}`}
              value={minutesLabel(plannedMin) || "0m"}
              tone={over ? "amber" : "default"}
            />
            <StatTile icon={Timer} label="Time spent" value={minutesLabel(spentToday) || "0m"} />
          </div>
          {todays.length > 0 && (
            <Progress value={Math.round((doneCount / todays.length) * 100)} />
          )}
          {over && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Today holds {minutesLabel(plannedMin)} of work, over your {minutesLabel(limitMin)}{" "}
                limit. Move something to tomorrow from its ⋯ menu.
              </span>
            </p>
          )}

          {/* Overdue — always on top */}
          {overdue.length > 0 && (
            <section className="space-y-2" aria-labelledby="overdue-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="overdue-heading"
                  className="flex items-center gap-2 text-sm font-semibold text-destructive"
                >
                  <AlertTriangle className="h-4 w-4" /> Overdue · {overdue.length}
                </h2>
                {overdue.length > 1 && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void actions.rescheduleMany(
                          overdue.map((task) => ({ task, date: today })),
                          `Moved ${overdue.length} tasks to today`
                        )
                      }
                    >
                      <Sun className="h-4 w-4" /> All to today
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void actions.rescheduleMany(
                          overdue.map((task) => ({ task, date: tomorrow })),
                          `Moved ${overdue.length} tasks to tomorrow`
                        )
                      }
                    >
                      <Sunrise className="h-4 w-4" /> All to tomorrow
                    </Button>
                  </div>
                )}
              </div>
              <Card className="border-destructive/30">
                <CardContent className="divide-y p-0">
                  {overdue.map((t) => (
                    <div key={t.id}>
                      <PlanTaskRow
                        task={t}
                        goal={goalFor(t)}
                        showGoalDot
                        context={goalFor(t)?.title ?? null}
                        {...rowProps}
                      />
                      <div className="flex gap-2 px-3 pb-2.5 pl-11 sm:px-4 sm:pl-12">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() => void actions.reschedule(t, today)}
                        >
                          <Sun className="h-3.5 w-3.5" /> Move to today
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => void actions.reschedule(t, tomorrow)}
                        >
                          <Sunrise className="h-3.5 w-3.5" /> Tomorrow
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Today, grouped by goal */}
          {groups.length === 0 ? (
            <EmptyState
              icon={overdue.length > 0 ? AlertTriangle : CheckCircle2}
              title={
                overdue.length > 0 ? "Nothing scheduled for today yet" : "Nothing planned for today"
              }
              description={
                overdue.length > 0
                  ? "Pull an overdue task into today above, or add something below."
                  : backlog.length > 0
                    ? `You have ${backlog.length} unscheduled ${
                        backlog.length === 1 ? "task" : "tasks"
                      } waiting. Auto-plan spreads them over the coming days.`
                    : "Add a task below, or open a goal and break it into tasks."
              }
              action={
                backlog.length > 0 ? (
                  <Button onClick={runAutoPlan}>
                    <Wand2 className="h-4 w-4" /> Auto-plan my backlog
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href="/goals">Open goals</Link>
                  </Button>
                )
              }
            />
          ) : (
            groups.map(({ key, goal, tasks: list }) => {
              const open = list.filter((t) => !isTaskDone(t)).length;
              return (
                <section key={key} className="space-y-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: goal?.color ?? "hsl(var(--muted-foreground))" }}
                    />
                    {goal ? (
                      <Link href={`/goals/${goal.id}`} className="truncate hover:underline">
                        {goal.icon ? `${goal.icon} ` : ""}
                        {goal.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">No goal</span>
                    )}
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      · {list.length - open}/{list.length}
                      {dayLoadMin(list) > 0 && ` · ${minutesLabel(dayLoadMin(list))}`}
                    </span>
                  </h2>
                  <Card
                    className={cn(open === 0 && "opacity-70")}
                    style={goal?.color ? { borderLeft: `3px solid ${goal.color}` } : undefined}
                  >
                    <CardContent className="divide-y p-0">
                      {list.map((t) => (
                        <PlanTaskRow key={t.id} task={t} goal={goal} {...rowProps} />
                      ))}
                    </CardContent>
                  </Card>
                </section>
              );
            })
          )}

          {/* Add for today */}
          <Card>
            <CardContent className="p-0">
              <TaskQuickAdd
                idSuffix="today"
                goals={activeGoals}
                defaultDate={today}
                placeholder="Add a task for today…"
                onAdd={addTask}
              />
            </CardContent>
          </Card>

          {/* Backlog nudge */}
          {backlog.length > 0 && groups.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarOff className="h-4 w-4 shrink-0" />
                {backlog.length} unscheduled {backlog.length === 1 ? "task" : "tasks"} in your
                backlog.
              </p>
              <Button size="sm" variant="outline" onClick={runAutoPlan}>
                <Wand2 className="h-4 w-4" /> Auto-plan
              </Button>
            </div>
          )}
        </>
      )}

      {user && (
        <TaskFormDialog
          open={editing != null}
          onOpenChange={(o) => !o && setEditing(null)}
          userId={user.uid}
          goalId={editing?.goalId ?? null}
          projectId={editing?.projectId ?? null}
          task={editing}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this task?"
        description={deleting ? `“${deleting.title}” will be removed for good.` : undefined}
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          setTasks((prev) => prev.filter((t) => t.id !== target.id));
          try {
            await deleteTask({ id: target.id, goalId: target.goalId });
          } catch {
            toast({ message: "Couldn't delete the task. Try again.", tone: "error" });
          }
          setDeleting(null);
          refresh();
        }}
      />
    </div>
  );
}
