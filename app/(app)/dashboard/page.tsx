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
  CalendarCheck,
  CalendarClock,
  Moon,
  GlassWater,
  Flame,
  CheckSquare,
  HelpCircle,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getActiveGoals,
  getDailyHabits,
  getGoals,
  getHabitLogs,
  getNutritionLog,
  getSessionsInRange,
  getSleepLogs,
  getTasks,
  getWeeklyReview,
  setTaskDone,
  toggleHabitLog,
  upsertNutritionLog,
  upsertSleepLog,
} from "@/lib/firebase/db";
import { greetingFor, resolveFirstName, toDateKey } from "@/lib/greeting";
import { habitStateFromDates, lastNDays, addDays } from "@/lib/habits";
import { sessionColor, rangeLabel, minToLabel } from "@/lib/sessions";
import { formatHours, smartDefaultSleep } from "@/lib/sleep";
import { DEFAULT_WATER_TARGET } from "@/lib/nutrition";
import { startOfWeekKey } from "@/lib/dates";
import { buildPriorityStack, type PriorityItem } from "@/lib/priority";
import { currentPermission, showNotification } from "@/lib/notify";
import { CATEGORY_LABEL } from "@/lib/labels";
import {
  EMOJI,
  greetingEmoji,
  GOAL_CATEGORY_EMOJI,
  HABIT_CATEGORY_EMOJI,
} from "@/lib/emoji";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollapsibleSection } from "@/components/collapsible-section";
import { NameSetup } from "@/components/name-setup";
import { LogTodayDialog } from "@/components/log-today-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitRow } from "@/components/habits/habit-row";
import { cn } from "@/lib/utils";
import type {
  Goal,
  GoalCategory,
  Habit,
  Session,
  SleepLog,
  Task,
} from "@/lib/types";

type FocusGroupKey = GoalCategory | "other";
const FOCUS_GROUP_ORDER: FocusGroupKey[] = [
  "education",
  "career",
  "health",
  "financial",
  "personal",
  "other",
];
const FOCUS_GROUP_LABEL: Record<FocusGroupKey, string> = {
  ...CATEGORY_LABEL,
  other: "Other",
};
const FOCUS_GROUP_EMOJI: Record<FocusGroupKey, string> = {
  ...GOAL_CATEGORY_EMOJI,
  other: "📌",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

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

/** A row that just links out (used when the action genuinely needs more space). */
function LinkPriorityRow({
  icon: Icon,
  title,
  detail,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function SleepPriorityRow({
  defaultHours,
  onLog,
}: {
  defaultHours: number;
  onLog: (hours: number) => Promise<void>;
}) {
  const [hours, setHours] = useState(defaultHours);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <Moon className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Log last night&apos;s sleep</p>
        <p className="text-xs text-muted-foreground">
          It&apos;s the #1 driver of your focus
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Slider
          value={hours}
          onValueChange={setHours}
          min={0}
          max={12}
          step={0.5}
          className="w-28"
          aria-label="Hours slept"
        />
        <span className="w-12 shrink-0 text-xs text-muted-foreground">
          {formatHours(hours)}
        </span>
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onLog(hours);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "…" : "Log"}
        </Button>
      </div>
    </div>
  );
}

function HabitsPriorityRow({
  remaining,
  total,
  onComplete,
}: {
  remaining: Habit[];
  total: number;
  onComplete: (habitId: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Flame className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {remaining.length} habit{remaining.length === 1 ? "" : "s"} left
            today
          </p>
          <p className="text-xs text-muted-foreground">
            {total - remaining.length}/{total} done — keep the streak
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 sm:pl-8">
        {remaining.map((h) => (
          <button
            key={h.id}
            onClick={() => onComplete(h.id)}
            className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {h.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function WaterPriorityRow({
  water,
  waterTarget,
  onAdjust,
}: {
  water: number;
  waterTarget: number;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <GlassWater className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Water: {water}/{waterTarget} glasses
        </p>
        <p className="text-xs text-muted-foreground">
          {waterTarget - water} more to hit your goal
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Remove a glass"
          onClick={() => onAdjust(-1)}
          disabled={water <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="icon" aria-label="Add a glass" onClick={() => onAdjust(1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TasksDuePriorityRow({
  due,
  onToggle,
}: {
  due: Task[];
  onToggle: (task: Task) => void;
}) {
  const shown = due.slice(0, 4);
  const extra = due.length - shown.length;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <CheckSquare className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm font-medium">
          {due.length} task{due.length === 1 ? "" : "s"} due today
        </p>
      </div>
      <div className="mt-2 space-y-1 sm:pl-8">
        {shown.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox checked={false} onCheckedChange={() => onToggle(t)} />
            <span className="truncate">{t.title}</span>
          </label>
        ))}
        {extra > 0 && (
          <Link
            href="/tasks"
            className="block text-xs text-primary hover:underline"
          >
            +{extra} more — view tasks
          </Link>
        )}
      </div>
    </div>
  );
}

function FocusGroupBlock({
  groupKey,
  tasks,
  onChanged,
}: {
  groupKey: FocusGroupKey;
  tasks: Task[];
  onChanged: () => void;
}) {
  const storageKey = `lifeos:collapse:focus-${groupKey}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved != null) setOpen(saved === "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="rounded-lg border">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">
          {FOCUS_GROUP_EMOJI[groupKey]}
        </span>
        <span className="text-sm font-medium">
          {FOCUS_GROUP_LABEL[groupKey]}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {openCount}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="divide-y border-t">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logDatesByHabit, setLogDatesByHabit] = useState<
    Record<string, string[]>
  >({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [water, setWater] = useState(0);
  const [waterTarget, setWaterTarget] = useState(DEFAULT_WATER_TARGET);
  const [reviewDoneThisWeek, setReviewDoneThisWeek] = useState(false);
  const [loading, setLoading] = useState(true);
  const waterRef = useRef(0);

  const [stackExpanded, setStackExpanded] = useState(false);
  const [logTodayOpen, setLogTodayOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const today = toDateKey(new Date());
  const thisWeekStart = startOfWeekKey(today);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [g, ag, h, t, logs, sess, sleep, nutrition, review] =
        await Promise.all([
          getActiveGoals(user.uid),
          getGoals(user.uid),
          getDailyHabits(user.uid),
          getTasks(user.uid),
          getHabitLogs(user.uid),
          getSessionsInRange(user.uid, today, today),
          getSleepLogs(user.uid),
          getNutritionLog(user.uid, today),
          getWeeklyReview(user.uid, thisWeekStart),
        ]);
      const byHabit: Record<string, string[]> = {};
      for (const log of logs) {
        (byHabit[log.habitId] ??= []).push(log.completedDate);
      }
      setGoals(g);
      setAllGoals(ag);
      setHabits(h);
      setTasks(t);
      setLogDatesByHabit(byHabit);
      setSessions(sess);
      setSleepLogs(sleep);
      setWater(nutrition?.water ?? 0);
      waterRef.current = nutrition?.water ?? 0;
      setWaterTarget(nutrition?.waterTarget ?? DEFAULT_WATER_TARGET);
      setReviewDoneThisWeek(review != null);
    } finally {
      setLoading(false);
    }
  }, [user, today, thisWeekStart]);

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

  async function handleQuickLogSleep(hours: number) {
    if (!user) return;
    await upsertSleepLog(user.uid, today, {
      hours,
      quality: sleepDefault.quality,
      notes: null,
    });
    await load();
  }

  async function handleQuickCompleteTask(task: Task) {
    await setTaskDone({ id: task.id, goalId: task.goalId }, true);
    await load();
  }

  const greeting = greetingFor(new Date().getHours());
  const name = resolveFirstName(displayName, user?.email);
  const isMonday = new Date().getDay() === 1;

  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length)
      : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak ?? 0), 0);
  const lastNight = sleepLogs[0];
  const habitsDoneToday = habits.filter((h) =>
    (logDatesByHabit[h.id] ?? []).includes(today)
  ).length;
  const habitsRemaining = habits.filter(
    (h) => !(logDatesByHabit[h.id] ?? []).includes(today)
  );

  // Sleep trend: last night vs the 7-day average — only shown with 2+ data points.
  const sleep7 = useMemo(() => {
    const cutoff = lastNDays(today, 7)[0];
    const recent = sleepLogs.filter((s) => s.date >= cutoff);
    if (recent.length === 0) return null;
    return recent.reduce((s, l) => s + l.hours, 0) / recent.length;
  }, [sleepLogs, today]);
  const sleepTrend =
    lastNight && sleep7 != null && sleepLogs.length >= 2
      ? Math.round((lastNight.hours - sleep7) * 10) / 10
      : null;

  const sleepDefault = useMemo(
    () => smartDefaultSleep(sleepLogs, addDays(today, -13)),
    [sleepLogs, today]
  );

  // Last-7-days daily-habit completion ratio per day (oldest → newest).
  const habitStrip = useMemo(() => {
    if (habits.length === 0) return [];
    return lastNDays(today, 7).map((d) => {
      const done = habits.filter((h) =>
        (logDatesByHabit[h.id] ?? []).includes(d)
      ).length;
      return { date: d, ratio: done / habits.length, done };
    });
  }, [habits, logDatesByHabit, today]);

  const tasksDueToday = tasks.filter(
    (t) => t.dueDate === today && t.status !== "done"
  );

  const nextSession = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return (
      [...sessions]
        .filter((s) => s.status === "planned" && s.startMin >= nowMinutes)
        .sort((a, b) => a.startMin - b.startMin)[0] ?? null
    );
  }, [sessions]);

  const priorityStack = useMemo(
    () =>
      buildPriorityStack({
        isMonday,
        reviewDoneThisWeek,
        sleepLoggedToday: sleepLogs.some((s) => s.date === today),
        habitsRemaining,
        habitsTotal: habits.length,
        water,
        waterTarget,
        tasksDueToday,
        nextSession,
      }),
    [
      isMonday,
      reviewDoneThisWeek,
      sleepLogs,
      habitsRemaining,
      habits.length,
      water,
      waterTarget,
      tasksDueToday,
      nextSession,
      today,
    ]
  );
  const visibleStack = priorityStack.slice(0, 4);
  const overflowStack = priorityStack.slice(4);

  function renderPriorityItem(item: PriorityItem, key: number) {
    switch (item.kind) {
      case "monday":
        return (
          <LinkPriorityRow
            key={key}
            icon={CalendarCheck}
            title="It's Monday — review last week"
            detail="Reflect on wins, blockers, and set this week's focus."
            href="/review"
          />
        );
      case "sleep":
        return (
          <SleepPriorityRow
            key={key}
            defaultHours={sleepDefault.hours}
            onLog={handleQuickLogSleep}
          />
        );
      case "habits":
        return (
          <HabitsPriorityRow
            key={key}
            remaining={item.remaining}
            total={item.total}
            onComplete={(id) => handleHabitToggle(id, true)}
          />
        );
      case "water":
        return (
          <WaterPriorityRow
            key={key}
            water={water}
            waterTarget={waterTarget}
            onAdjust={adjustWater}
          />
        );
      case "tasks":
        return (
          <TasksDuePriorityRow
            key={key}
            due={item.due}
            onToggle={handleQuickCompleteTask}
          />
        );
      case "session": {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const mins = item.session.startMin - nowMinutes;
        const detail =
          mins <= 60
            ? `starts in ${Math.max(0, mins)} min`
            : `at ${minToLabel(item.session.startMin)}`;
        return (
          <LinkPriorityRow
            key={key}
            icon={CalendarClock}
            title={`Up next: ${item.session.title}`}
            detail={detail}
            href="/sessions"
          />
        );
      }
      default:
        return null;
    }
  }

  // Today's Focus: open tasks + tasks completed today, grouped by the
  // category of their linked goal (or "Other").
  const categoryById = useMemo(() => {
    const m = new Map<string, GoalCategory | null>();
    for (const g of allGoals) m.set(g.id, g.category);
    return m;
  }, [allGoals]);

  const openTasksSorted = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          const ad = a.dueDate ?? "9999-12-31";
          const bd = b.dueDate ?? "9999-12-31";
          if (ad !== bd) return ad < bd ? -1 : 1;
          return (
            (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
          );
        }),
    [tasks]
  );
  const todayCompletedTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "done" &&
          t.completedAt != null &&
          toDateKey(new Date(t.completedAt)) === today
      ),
    [tasks, today]
  );

  const focusGroups = useMemo(() => {
    const groups = new Map<FocusGroupKey, Task[]>();
    for (const key of FOCUS_GROUP_ORDER) groups.set(key, []);
    for (const t of [...openTasksSorted, ...todayCompletedTasks]) {
      const cat = t.goalId ? categoryById.get(t.goalId) ?? null : null;
      const key: FocusGroupKey = cat ?? "other";
      groups.get(key)!.push(t);
    }
    return FOCUS_GROUP_ORDER.map((key) => ({
      key,
      tasks: groups.get(key) ?? [],
    })).filter((g) => g.tasks.length > 0);
  }, [openTasksSorted, todayCompletedTasks, categoryById]);

  const hasAnythingToLog =
    !sleepLogs.some((s) => s.date === today) ||
    water < waterTarget ||
    habitsRemaining.length > 0;

  useEffect(() => {
    if (loading || priorityStack.length === 0) return;
    if (currentPermission() !== "granted") return;
    const key = "lifeos:nudgeNotified";
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      return;
    }
    const top = visibleStack[0];
    if (!top) return;
    const title =
      top.kind === "monday"
        ? "It's Monday — review last week"
        : top.kind === "sleep"
          ? "Log last night's sleep"
          : top.kind === "habits"
            ? `${top.remaining.length} habits left today`
            : top.kind === "water"
              ? `Water: ${water}/${waterTarget} glasses`
              : top.kind === "tasks"
                ? `${top.due.length} tasks due today`
                : `Up next: ${top.session.title}`;
    showNotification("Life OS — today", title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, today]);

  // Keyboard shortcuts: n = new task, g = new goal, l = Log today.
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (taskFormOpen || goalFormOpen || logTodayOpen) return;
      if (e.key === "n") {
        e.preventDefault();
        setTaskFormOpen(true);
      } else if (e.key === "g") {
        e.preventDefault();
        setGoalFormOpen(true);
      } else if (e.key === "l") {
        e.preventDefault();
        if (hasAnythingToLog) setLogTodayOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taskFormOpen, goalFormOpen, logTodayOpen, hasAnythingToLog]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statsAreEmpty = goals.length === 0 && bestStreak === 0;

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

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Quick add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setTaskFormOpen(true)}>
              New task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGoalFormOpen(true)}>
              New goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant={hasAnythingToLog ? "default" : "outline"}
          onClick={() => {
            if (hasAnythingToLog) setLogTodayOpen(true);
          }}
        >
          {hasAnythingToLog ? (
            <>
              <ClipboardList className="h-4 w-4" /> Log today
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> All logged
            </>
          )}
        </Button>
      </div>

      {/* One-time name prompt */}
      {!displayName && <NameSetup />}

      {/* Priority stack */}
      {priorityStack.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Priority stack</span>
            </div>
            <div className="divide-y">
              {visibleStack.map((item, i) => renderPriorityItem(item, i))}
            </div>
            {overflowStack.length > 0 && (
              <div className="border-t">
                {!stackExpanded ? (
                  <button
                    onClick={() => setStackExpanded(true)}
                    className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    +{overflowStack.length} more
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <div className="divide-y">
                    {overflowStack.map((item, i) =>
                      renderPriorityItem(item, i + 100)
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat tiles (auto-hidden when there's no meaningful data yet) */}
      {statsAreEmpty ? (
        <p className="px-1 text-sm text-muted-foreground">
          Your stats will show up here once you&apos;ve logged a few days.
        </p>
      ) : (
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
            label={
              sleepTrend != null && sleepTrend !== 0
                ? `Last night · ${sleepTrend > 0 ? "↑" : "↓"} ${Math.abs(
                    sleepTrend
                  )}h vs avg`
                : "Last night"
            }
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
      )}

      {/* Bento grid */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Today's Focus — grouped by category, collapsible per group */}
        <CollapsibleSection
          id="focus"
          emoji={EMOJI.focus}
          title="Today's Focus"
          count={openTasksSorted.length || undefined}
          className="lg:col-span-3"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">View tasks</Link>
            </Button>
          }
        >
          {focusGroups.length === 0 ? (
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
            <div className="space-y-2">
              {focusGroups.map((group) => (
                <FocusGroupBlock
                  key={group.key}
                  groupKey={group.key}
                  tasks={group.tasks}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

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
            <div className="space-y-3">
              {/* Last 7 days at a glance */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last 7 days</span>
                <div className="flex gap-1">
                  {habitStrip.map((d) => (
                    <span
                      key={d.date}
                      title={`${d.date}: ${d.done}/${habits.length}`}
                      className={cn(
                        "h-5 w-5 rounded",
                        d.ratio === 0 && "bg-muted"
                      )}
                      style={
                        d.ratio > 0
                          ? {
                              backgroundColor: "hsl(var(--primary))",
                              opacity: 0.25 + d.ratio * 0.75,
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
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

      {/* Dialogs */}
      {user && (
        <>
          <LogTodayDialog
            open={logTodayOpen}
            onOpenChange={setLogTodayOpen}
            userId={user.uid}
            today={today}
            sleepLoggedToday={sleepLogs.some((s) => s.date === today)}
            sleepDefault={sleepDefault}
            water={water}
            waterTarget={waterTarget}
            habitsRemaining={habitsRemaining}
            onSaved={load}
          />
          <TaskFormDialog
            open={taskFormOpen}
            onOpenChange={setTaskFormOpen}
            userId={user.uid}
            goalId={null}
            projectId={null}
            onSaved={load}
          />
          <GoalFormDialog
            open={goalFormOpen}
            onOpenChange={setGoalFormOpen}
            userId={user.uid}
            onSaved={load}
          />
        </>
      )}

      {/* Shortcuts help */}
      <div className="fixed bottom-5 right-5 z-40">
        {shortcutsOpen && (
          <div className="mb-2 w-56 rounded-lg border bg-card p-3 text-sm shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shortcuts
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New task</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">n</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New goal</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">g</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Log today</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">l</kbd>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full shadow-md"
          aria-label="Keyboard shortcuts"
          onClick={() => setShortcutsOpen((o) => !o)}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
