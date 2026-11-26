"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  createTask,
  deleteTask,
  getDailyHabits,
  getGoals,
  getHabitLogs,
  getPrefs,
  getSessions,
  getSleepLogs,
  getTasks,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate, formatMonthYear, formatWeekRange, monthGrid, startOfWeekKey } from "@/lib/dates";
import { buildCalData, dayHasContent, dayView, type CalToggles } from "@/lib/calendar";
import {
  DEFAULT_DAILY_LIMIT_MIN,
  autoPlan,
  dayLoadMin,
  isOverLimit,
  isTaskDone,
  isTaskUnscheduled,
  minutesLabel,
  sortPlanTasks,
} from "@/lib/planner";
import { deadlineWarning } from "@/lib/planner-actions";
import { usePlannerActions } from "@/lib/use-planner-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DayAgenda } from "@/components/calendar/day-agenda";
import { LoadError } from "@/components/planner/load-error";
import { PlannerCalendar, type DayMarker } from "@/components/planner/planner-calendar";
import { PlanTaskRow } from "@/components/planner/plan-task-row";
import { TaskQuickAdd, type QuickAddValues } from "@/components/planner/task-quick-add";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { cn } from "@/lib/utils";
import type { Goal, Habit, HabitLog, Session, SleepLog, Task } from "@/lib/types";

type ViewMode = "month" | "week";
const VIEW_KEY = "lifeos:calendar:view";
// The planner grid already shows tasks and goal dates; the agenda below a
// selected day adds the rest of life (sessions, habits, sleep).
const LIFE_TOGGLES: CalToggles = {
  sessions: true,
  tasks: false,
  habits: true,
  sleep: true,
  goals: false,
};

interface Life {
  sessions: Session[];
  dailyHabits: Habit[];
  habitLogs: HabitLog[];
  sleep: SleepLog[];
}
const NO_LIFE: Life = { sessions: [], dailyHabits: [], habitLogs: [], sleep: [] };

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = toDateKey(new Date());

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [life, setLife] = useState<Life>(NO_LIFE);
  const [limitMin, setLimitMin] = useState(DEFAULT_DAILY_LIMIT_MIN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "week" || v === "month") setView(v);
    } catch {
      /* ignore */
    }
  }, []);
  function chooseView(v: ViewMode) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

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
        console.error("Calendar failed to load:", err);
        if (!silent) setLoadError(true);
      } finally {
        if (!silent) setLoading(false);
      }
      if (silent) return;
      // Extras never block the planner.
      try {
        setLimitMin((await getPrefs(user.uid)).dailyLimitMin);
      } catch {
        /* keep the default */
      }
      try {
        const [sessions, dailyHabits, habitLogs, sleep] = await Promise.all([
          getSessions(user.uid),
          getDailyHabits(user.uid),
          getHabitLogs(user.uid),
          getSleepLogs(user.uid),
        ]);
        setLife({ sessions, dailyHabits, habitLogs, sleep });
      } catch {
        /* the agenda just stays empty */
      }
    },
    [user]
  );
  useEffect(() => {
    void load();
  }, [load]);
  const refresh = useCallback(() => void load(true), [load]);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const goalFor = useCallback(
    (task: Task) => (task.goalId ? goalsById.get(task.goalId) : null),
    [goalsById]
  );
  const actions = usePlannerActions({ mutate: setTasks, refresh, goalFor });

  // Parked goals (paused / archived) stay off the planner.
  const live = useMemo(
    () =>
      tasks.filter((t) => {
        const g = t.goalId ? goalsById.get(t.goalId) : null;
        return !g || (g.status !== "paused" && g.status !== "archived");
      }),
    [tasks, goalsById]
  );
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of live) {
      if (!t.dueDate) continue;
      map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    }
    return map;
  }, [live]);
  const unscheduled = useMemo(() => sortPlanTasks(live.filter(isTaskUnscheduled)), [live]);

  const markersByDate = useMemo(() => {
    const map = new Map<string, DayMarker[]>();
    const push = (date: string, m: DayMarker) => map.set(date, [...(map.get(date) ?? []), m]);
    for (const g of goals) {
      if (g.status !== "active") continue;
      if (g.deadline) push(g.deadline, { kind: "deadline", title: g.title, color: g.color });
      for (const m of g.milestones)
        if (m.dueDate && !m.done)
          push(m.dueDate, { kind: "milestone", title: m.title, color: g.color });
    }
    return map;
  }, [goals]);

  const cursorDate = new Date(cursor + "T00:00:00");
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const weekStart = startOfWeekKey(cursor);
  const days = useMemo(
    () =>
      view === "month"
        ? monthGrid(year, month).flat()
        : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [view, year, month, weekStart]
  );

  function navigate(dir: -1 | 1) {
    if (view === "month") setCursor(toDateKey(new Date(year, month + dir, 1)));
    else setCursor(addDays(weekStart, dir * 7));
  }
  function goToday() {
    setCursor(today);
    setSelected(today);
  }

  const lifeData = useMemo(
    () => buildCalData({ ...life, tasks: [], goals: [] }),
    [life]
  );
  const selectedLife = dayView(lifeData, selected);
  const selectedTasks = sortPlanTasks(tasksByDate.get(selected) ?? []);
  const selectedLoad = dayLoadMin(selectedTasks.filter((t) => !isTaskDone(t)));
  const selectedOver = isOverLimit(selectedLoad, limitMin);
  const selectedMarkers = markersByDate.get(selected) ?? [];
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
    void actions.rescheduleMany(
      moves,
      `Planned ${moves.length} ${moves.length === 1 ? "task" : "tasks"}`
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-2xl font-bold md:text-3xl">Calendar</h1>
          <p className="text-muted-foreground">
            Drag tasks between days. Daily limit: {minutesLabel(limitMin)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unscheduled.length > 0 && (
            <Button variant="outline" size="sm" onClick={runAutoPlan}>
              <Wand2 className="h-4 w-4" /> Auto-plan
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(["month", "week"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => chooseView(v)}
                aria-pressed={view === v}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Previous"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 truncate text-sm font-medium sm:text-base">
          {view === "month" ? formatMonthYear(year, month) : formatWeekRange(weekStart)}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      ) : loadError ? (
        <LoadError title="Couldn't load the calendar" onRetry={() => void load()} />
      ) : (
        <>
          <PlannerCalendar
            view={view}
            days={days}
            year={year}
            month={month}
            today={today}
            selected={selected}
            onSelect={setSelected}
            tasksByDate={tasksByDate}
            unscheduled={unscheduled}
            markersByDate={markersByDate}
            goalsById={goalsById}
            limitMin={limitMin}
            onReschedule={actions.reschedule}
            onOpenTask={setEditing}
          />

          {/* Selected day: its tasks, add one, and the rest of that day's life */}
          <section className="space-y-2" aria-labelledby="day-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="day-heading" className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {formatLongDate(selected)}
                {selected === today && <span className="text-primary">· Today</span>}
              </h2>
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  selectedOver && "font-semibold text-amber-600 dark:text-amber-400"
                )}
              >
                {selectedLoad > 0
                  ? `${minutesLabel(selectedLoad)} planned${
                      selectedOver ? ` · over your ${minutesLabel(limitMin)} limit` : ""
                    }`
                  : "Nothing estimated"}
              </p>
            </div>
            {selectedMarkers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedMarkers
                  .map((m) => `${m.kind === "deadline" ? "Deadline" : "Milestone"}: ${m.title}`)
                  .join(" · ")}
              </p>
            )}
            <Card>
              <CardContent className="p-0">
                {selectedTasks.length > 0 ? (
                  <div className="divide-y">
                    {selectedTasks.map((t) => (
                      <PlanTaskRow
                        key={t.id}
                        task={t}
                        goal={goalFor(t)}
                        showGoalDot
                        context={goalFor(t)?.title ?? null}
                        today={today}
                        onToggleDone={actions.toggleDone}
                        onReschedule={actions.reschedule}
                        onToggleTimer={actions.toggleTimer}
                        onAddTime={actions.addTime}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 pt-4 text-center text-sm text-muted-foreground">
                    No tasks this day. Add one below or drag one here.
                  </p>
                )}
                <div className={cn(selectedTasks.length > 0 && "border-t")}>
                  <TaskQuickAdd
                    key={selected}
                    idSuffix="calendar"
                    goals={activeGoals}
                    defaultDate={selected}
                    placeholder={`Add a task on ${formatLongDate(selected)}…`}
                    onAdd={addTask}
                  />
                </div>
              </CardContent>
            </Card>
            {dayHasContent(selectedLife, LIFE_TOGGLES) && (
              <Card>
                <CardContent className="p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Also this day
                  </p>
                  <DayAgenda day={selectedLife} toggles={LIFE_TOGGLES} />
                </CardContent>
              </Card>
            )}
          </section>
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
