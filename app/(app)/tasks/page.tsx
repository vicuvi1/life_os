"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getTasks,
  getGoals,
  getProjects,
  createTask,
  updateTask,
  setTaskDone,
  deleteTask,
  generateRecurringOccurrences,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import {
  startOfWeekKey,
  formatWeekRange,
  formatMonthYear,
  formatLongDate,
} from "@/lib/dates";
import { minToLabel } from "@/lib/sessions";
import {
  autoSchedule,
  durationLabel,
  planRecurringOccurrences,
  scheduleAtMin,
  tasksByDate as buildTasksByDate,
  upcomingReminders,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import { TaskWeekView } from "@/components/tasks/task-week-view";
import { TaskTodayView } from "@/components/tasks/task-today-view";
import { TaskMonthView } from "@/components/tasks/task-month-view";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskPlanView } from "@/components/tasks/task-plan-view";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { cn } from "@/lib/utils";
import type { Goal, Project, Task } from "@/lib/types";

type ViewMode = "today" | "week" | "month" | "plan" | "list";
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "plan", label: "Plan" },
  { key: "list", label: "List" },
];

const HORIZON_DAYS = 35; // how far ahead recurring occurrences are materialized

type FormDefaults = {
  dueDate?: string | null;
  startMin?: number | null;
  endMin?: number | null;
};

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = toDateKey(new Date());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(today); // focus date for week/month
  const [selected, setSelected] = useState(today); // month: selected day

  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState<FormDefaults>({});
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());

  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, g, p] = await Promise.all([
        getTasks(user.uid),
        getGoals(user.uid),
        getProjects(user.uid),
      ]);
      setGoals(g);
      setProjects(p);
      // Materialize any missing recurring occurrences up to the horizon, then
      // read back once so the calendar shows them. Idempotent: once generated
      // they exist and subsequent loads create nothing.
      const plan = planRecurringOccurrences(t, today, addDays(today, HORIZON_DAYS));
      if (plan.length > 0) {
        try {
          await generateRecurringOccurrences(user.uid, plan);
          setTasks(await getTasks(user.uid));
        } catch {
          setTasks(t);
        }
      } else {
        setTasks(t);
      }
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the "starting soon" reminders honest as the clock advances.
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Lookups.
  const goalTitle = useMemo(() => {
    const m = new Map(goals.map((g) => [g.id, g.title]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [goals]);
  const projectTitle = useMemo(() => {
    const m = new Map(projects.map((p) => [p.id, p.title]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [projects]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !pendingDeleteIds.has(t.id)),
    [tasks, pendingDeleteIds]
  );
  const byDate = useMemo(() => buildTasksByDate(visibleTasks), [visibleTasks]);
  const backlog = useMemo(
    () => visibleTasks.filter((t) => !t.dueDate && t.status !== "done"),
    [visibleTasks]
  );
  const reminders = useMemo(
    () =>
      upcomingReminders(visibleTasks, today, nowMin).filter(
        (r) => !dismissedReminders.has(r.task.id)
      ),
    [visibleTasks, today, nowMin, dismissedReminders]
  );

  const weekStart = startOfWeekKey(cursor);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const cursorDate = new Date(cursor + "T00:00:00");
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();

  const detailTask = detailId ? visibleTasks.find((t) => t.id === detailId) ?? null : null;

  // Nudge to schedule when the calendar is empty but there's a backlog.
  const weekHasTasks = weekDates.some((k) => (byDate.get(k)?.length ?? 0) > 0);
  const showEmptyHint =
    backlog.length > 0 &&
    ((view === "week" && !weekHasTasks) ||
      (view === "today" && (byDate.get(today)?.length ?? 0) === 0));

  // -- Mutations -------------------------------------------------------------
  /** Optimistically patch one task in local state; returns a revert fn. */
  function patch(id: string, updater: (t: Task) => Task): () => void {
    let snapshot: Task[] = [];
    setTasks((cur) => {
      snapshot = cur;
      return cur.map((t) => (t.id === id ? updater(t) : t));
    });
    return () => setTasks(snapshot);
  }

  function toggleDone(task: Task, done: boolean) {
    const revert = patch(task.id, (t) => ({
      ...t,
      status: done ? "done" : "todo",
      completedAt: done ? Date.now() : null,
    }));
    setTaskDone({ id: task.id, goalId: task.goalId }, done).catch(() => {
      revert();
      toast({ title: "Couldn't update task" });
    });
  }

  function toggleSubtask(task: Task, subtaskId: string) {
    const next = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    const revert = patch(task.id, (t) => ({ ...t, subtasks: next }));
    updateTask(task.id, { subtasks: next }).catch(() => {
      revert();
      toast({ title: "Couldn't update subtask" });
    });
  }

  function reschedule(taskId: string, date: string, startMin: number | null) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const sched = scheduleAtMin(task, startMin);
    // No-op guard: dropped exactly where it already is.
    if (
      task.dueDate === date &&
      task.startMin === sched.startMin &&
      task.endMin === sched.endMin
    )
      return;
    const revert = patch(taskId, (t) => ({
      ...t,
      dueDate: date,
      startMin: sched.startMin,
      endMin: sched.endMin,
    }));
    updateTask(taskId, {
      dueDate: date,
      startMin: sched.startMin,
      endMin: sched.endMin,
    })
      .then(() => {
        const when =
          sched.startMin != null ? ` · ${minToLabel(sched.startMin)}` : "";
        toast({
          title: "Task moved",
          description: `${task.title} → ${formatLongDate(date)}${when}`,
        });
      })
      .catch(() => {
        revert();
        toast({ title: "Couldn't move task" });
      });
  }

  function resizeTask(taskId: string, endMin: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.startMin == null || task.endMin === endMin) return;
    const revert = patch(taskId, (t) => ({ ...t, endMin }));
    updateTask(taskId, { endMin })
      .then(() =>
        toast({
          title: "Duration updated",
          description: `${task.title} · ${durationLabel(endMin - (task.startMin as number))}`,
        })
      )
      .catch(() => {
        revert();
        toast({ title: "Couldn't resize task" });
      });
  }

  function unschedule(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.dueDate === null && task.startMin === null) return;
    const revert = patch(taskId, (t) => ({
      ...t,
      dueDate: null,
      startMin: null,
      endMin: null,
    }));
    updateTask(taskId, { dueDate: null, startMin: null, endMin: null })
      .then(() => toast({ title: "Moved to backlog", description: task.title }))
      .catch(() => {
        revert();
        toast({ title: "Couldn't update task" });
      });
  }

  async function handleAutoSchedule() {
    const scheduled = visibleTasks.filter(
      (t) => t.dueDate && t.startMin != null && t.status !== "done"
    );
    const placements = autoSchedule(backlog, scheduled, { fromKey: today, days: 7 });
    if (placements.length === 0) {
      toast({
        title: "No free slots",
        description: "Couldn't fit tasks in the next 7 days' work hours.",
      });
      return;
    }
    setAutoScheduling(true);
    const byId = new Map(placements.map((p) => [p.taskId, p]));
    let snapshot: Task[] = [];
    setTasks((cur) => {
      snapshot = cur;
      return cur.map((t) => {
        const p = byId.get(t.id);
        return p ? { ...t, dueDate: p.dueDate, startMin: p.startMin, endMin: p.endMin } : t;
      });
    });
    try {
      await Promise.all(
        placements.map((p) =>
          updateTask(p.taskId, {
            dueDate: p.dueDate,
            startMin: p.startMin,
            endMin: p.endMin,
          })
        )
      );
      toast({
        title: `Scheduled ${placements.length} task${placements.length > 1 ? "s" : ""}`,
        description: "Filled the earliest free work-hour slots by priority.",
      });
    } catch {
      setTasks(snapshot);
      toast({ title: "Couldn't auto-schedule" });
    } finally {
      setAutoScheduling(false);
    }
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !quickTitle.trim()) return;
    setAdding(true);
    try {
      // Quick tasks land on the focused day (today by default) as all-day, so
      // they show up on the calendar immediately.
      const day = view === "month" ? selected : view === "today" ? today : today;
      await createTask(user.uid, {
        title: quickTitle.trim(),
        description: null,
        priority: "medium",
        dueDate: day,
        goalId: null,
        projectId: null,
      });
      setQuickTitle("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  function openNew(defaults: FormDefaults) {
    setEditing(null);
    setFormDefaults(defaults);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setFormDefaults({});
    setFormOpen(true);
  }

  function onAddToCell(date: string, startMin: number | null) {
    const sched = scheduleAtMin({ startMin: null, endMin: null }, startMin);
    openNew({ dueDate: date, startMin: sched.startMin, endMin: sched.endMin });
  }

  // Reversible delete with an Undo toast.
  function handleDelete(task: Task) {
    setDetailId((id) => (id === task.id ? null : id));
    setPendingDeleteIds((prev) => new Set(prev).add(task.id));
    const timer = setTimeout(async () => {
      deleteTimers.current.delete(task.id);
      await deleteTask({ id: task.id, goalId: task.goalId });
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      await load();
    }, 5000);
    deleteTimers.current.set(task.id, timer);

    toast({
      title: "Task deleted",
      description: task.title,
      actionLabel: "Undo",
      onAction: () => {
        const t = deleteTimers.current.get(task.id);
        if (t) {
          clearTimeout(t);
          deleteTimers.current.delete(task.id);
        }
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      },
    });
  }

  // -- Navigation ------------------------------------------------------------
  function navigate(dir: -1 | 1) {
    if (view === "month") setCursor(toDateKey(new Date(year, month + dir, 1)));
    else setCursor(addDays(weekStart, dir * 7)); // week + plan share the week grid
  }
  function goToday() {
    setCursor(today);
    setSelected(today);
  }

  const rangeLabel =
    view === "week" || view === "plan"
      ? formatWeekRange(weekStart)
      : view === "month"
        ? formatMonthYear(year, month)
        : view === "today"
          ? formatLongDate(today)
          : "";

  const showNav = view === "week" || view === "month" || view === "plan";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Tasks</h1>
          <p className="text-muted-foreground">
            Plan your week visually — drag to reschedule, block time, ship your goals.
          </p>
        </div>
        <Button onClick={() => openNew({ dueDate: view === "month" ? selected : today })}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </div>

      {/* View switcher + quick add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleQuickAdd} className="flex min-w-[220px] flex-1 gap-2">
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add a task and press Enter…"
          />
          <Button type="submit" variant="outline" disabled={adding || !quickTitle.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      </div>

      {/* Period nav */}
      {showNav && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" aria-label="Previous" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-medium">{rangeLabel}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {view === "today" && (
        <p className="font-medium">{rangeLabel}</p>
      )}

      {/* Starting-soon reminders (in-app; push rides the daily run) */}
      {reminders.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
          {reminders.slice(0, 3).map(({ task, minutesUntil }) => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{task.title}</span>{" "}
                {minutesUntil <= 0 ? "starts now" : `starts in ${minutesUntil} min`}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDismissedReminders((prev) => new Set(prev).add(task.id))
                }
                aria-label="Dismiss reminder"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEmptyHint && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{backlog.length}</span>{" "}
            unscheduled task{backlog.length > 1 ? "s" : ""} — put them on the calendar.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("plan")}>
              Open planner
            </Button>
            <Button size="sm" onClick={handleAutoSchedule} disabled={autoScheduling}>
              {autoScheduling ? "Scheduling…" : "Auto-schedule"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : view === "week" ? (
        <TaskWeekView
          weekDates={weekDates}
          today={today}
          tasksByDate={byDate}
          goalTitle={goalTitle}
          onOpen={(t) => setDetailId(t.id)}
          onToggleDone={toggleDone}
          onReschedule={reschedule}
          onResize={resizeTask}
          onAdd={onAddToCell}
        />
      ) : view === "today" ? (
        <TaskTodayView
          date={today}
          tasks={byDate.get(today) ?? []}
          goalTitle={goalTitle}
          onOpen={(t) => setDetailId(t.id)}
          onToggleDone={toggleDone}
          onReschedule={reschedule}
          onAdd={onAddToCell}
        />
      ) : view === "month" ? (
        <TaskMonthView
          year={year}
          month={month}
          today={today}
          selected={selected}
          onSelect={setSelected}
          tasksByDate={byDate}
          goalTitle={goalTitle}
          onOpen={(t) => setDetailId(t.id)}
          onToggleDone={toggleDone}
        />
      ) : view === "plan" ? (
        <TaskPlanView
          weekDates={weekDates}
          today={today}
          tasksByDate={byDate}
          backlog={backlog}
          goalTitle={goalTitle}
          onOpen={(t) => setDetailId(t.id)}
          onToggleDone={toggleDone}
          onReschedule={reschedule}
          onResize={resizeTask}
          onUnschedule={unschedule}
          onAdd={onAddToCell}
          onAutoSchedule={handleAutoSchedule}
          autoScheduling={autoScheduling}
        />
      ) : (
        <TaskListView
          tasks={visibleTasks}
          today={today}
          goalTitle={goalTitle}
          onChanged={load}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Detail sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={detailId !== null && detailTask !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        goalTitle={goalTitle(detailTask?.goalId ?? null)}
        projectTitle={projectTitle(detailTask?.projectId ?? null)}
        onToggleDone={toggleDone}
        onToggleSubtask={toggleSubtask}
        onEdit={(t) => {
          setDetailId(null);
          openEdit(t);
        }}
        onDelete={handleDelete}
      />

      {/* Create / edit dialog */}
      {user && (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          userId={user.uid}
          goalId={editing?.goalId ?? null}
          projectId={editing?.projectId ?? null}
          task={editing}
          defaults={editing ? undefined : formDefaults}
          onSaved={load}
        />
      )}
    </div>
  );
}
