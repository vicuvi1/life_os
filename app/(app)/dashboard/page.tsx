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
  Plus,
  Minus,
  Bell,
  ChevronRight,
  ChevronDown,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  CheckCircle2,
  Circle,
  CheckSquare,
  HelpCircle,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  GlassWater,
  Flame,
  Target,
  TrendingUp,
  GraduationCap,
  Briefcase,
  Award,
  Dumbbell,
  Wallet,
  Sprout,
  Pin,
  BookOpen,
  Pill,
  Check,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getActiveGoals,
  getDailyHabits,
  getGoals,
  getHabitLogs,
  getNutritionLog,
  getPrefs,
  getSessionsInRange,
  getSleepLogs,
  getTasks,
  getTrackerLogs,
  getTrackers,
  getWeeklyReview,
  setHabitLogValue,
  setTaskDone,
  setTrackerLog,
  toggleHabitLog,
  upsertNutritionLog,
  upsertSleepLog,
} from "@/lib/firebase/db";
import { greetingFor, resolveFirstName, toDateKey } from "@/lib/greeting";
import {
  habitStateFromDates,
  lastNDays,
  addDays,
  doneDates,
} from "@/lib/habits";
import { sessionColor, rangeLabel, minToLabel } from "@/lib/sessions";
import { formatHours, smartDefaultSleep } from "@/lib/sleep";
import { DEFAULT_WATER_TARGET } from "@/lib/nutrition";
import { startOfWeekKey } from "@/lib/dates";
import { buildPriorityStack, type PriorityItem } from "@/lib/priority";
import { trackerIcon, formatTrackerValue, trackerValueMeetsTarget } from "@/lib/trackers";
import { currentPermission, showNotification } from "@/lib/notify";
import { CATEGORY_LABEL } from "@/lib/labels";
import {
  daysToDeadline,
  goalPace,
  goalStale,
  goalNextAction,
  goalMomentum,
  type NextAction,
} from "@/lib/goals";
import { completeGoalNextAction } from "@/lib/goal-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "@/components/ui/number-field";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
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
import { HabitFormDialog } from "@/components/habits/habit-form-dialog";
import { TrackerFormDialog } from "@/components/trackers/tracker-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitRow } from "@/components/habits/habit-row";
import { MomentumChip } from "@/components/goals/goal-card";
import { cn } from "@/lib/utils";
import type {
  Goal,
  GoalCategory,
  Habit,
  HabitCategory,
  HabitLog,
  Session,
  SleepLog,
  Task,
  Tracker,
  TrackerLog,
} from "@/lib/types";

const GOAL_CATEGORY_ICON: Record<GoalCategory, LucideIcon> = {
  education: GraduationCap,
  career: Briefcase,
  certification: Award,
  health: Dumbbell,
  financial: Wallet,
  personal: Sprout,
};

const HABIT_CATEGORY_ICON: Record<HabitCategory, LucideIcon> = {
  morning: Sunrise,
  evening: Moon,
  exercise: Dumbbell,
  learning: BookOpen,
  health: Pill,
};

type FocusGroupKey = GoalCategory | "other";
const FOCUS_GROUP_ORDER: FocusGroupKey[] = [
  "education",
  "career",
  "certification",
  "health",
  "financial",
  "personal",
  "other",
];
const FOCUS_GROUP_LABEL: Record<FocusGroupKey, string> = {
  ...CATEGORY_LABEL,
  other: "Other",
};
const FOCUS_GROUP_ICON: Record<FocusGroupKey, LucideIcon> = {
  ...GOAL_CATEGORY_ICON,
  other: Pin,
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function greetingIconFor(hour: number): LucideIcon {
  if (hour < 5) return Moon;
  if (hour < 12) return Sunrise;
  if (hour < 17) return Sun;
  if (hour < 22) return Sunset;
  return Moon;
}

function StatTile({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold leading-tight">{value}</p>
            <p className="truncate text-xs text-muted-foreground">{label}</p>
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
  icon: LucideIcon;
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
  const [touched, setTouched] = useState(false);
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
          onValueChange={(v) => {
            setHours(v);
            setTouched(true);
          }}
          min={0}
          max={12}
          step={0.5}
          className="w-24"
          aria-label="Hours slept"
        />
        <NumberField
          value={hours}
          onCommit={(v) => {
            setHours(v);
            setTouched(true);
          }}
          min={0}
          max={24}
          suffix="h"
          suggested={!touched}
          aria-label="Hours slept (type exact value)"
        />
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
  onComplete: (habit: Habit) => void;
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
            onClick={() => onComplete(h)}
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
  waterUnit,
  onAdjust,
  onSet,
  onSetTarget,
}: {
  water: number;
  waterTarget: number;
  waterUnit: string;
  onAdjust: (delta: number) => void;
  onSet: (value: number) => void;
  onSetTarget: (value: number) => void;
}) {
  const step = waterUnit === "liters" ? 0.25 : 1;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <GlassWater className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium">
          Water:
          <NumberField
            value={water}
            onCommit={onSet}
            min={0}
            decimals={waterUnit === "liters"}
            aria-label="Water logged (type exact value)"
            inputClassName="w-12"
          />
          <span className="text-muted-foreground">/</span>
          <NumberField
            value={waterTarget}
            onCommit={onSetTarget}
            min={step}
            decimals={waterUnit === "liters"}
            suffix={waterUnit}
            aria-label="Water target (click to edit)"
            inputClassName="w-12"
          />
        </p>
        <p className="text-xs text-muted-foreground">
          Target is editable — click the second number
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Remove"
          onClick={() => onAdjust(-step)}
          disabled={water <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="icon" aria-label="Add" onClick={() => onAdjust(step)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TrackerPriorityRow({
  tracker,
  onLog,
}: {
  tracker: Tracker;
  onLog: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState<number>(tracker.target ?? 0);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const Icon = trackerIcon(tracker.icon);

  async function save(v: number) {
    setSaving(true);
    try {
      await onLog(v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{tracker.name}</p>
        <p className="text-xs text-muted-foreground">
          {tracker.type === "yesno"
            ? "Did it happen today?"
            : tracker.target != null
              ? `Target: ${formatTrackerValue(tracker, tracker.target)}`
              : "Log today's value"}
        </p>
      </div>
      {tracker.type === "yesno" ? (
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => save(1)} disabled={saving}>
            <Check className="h-4 w-4" /> Yes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => save(0)}
            disabled={saving}
          >
            <X className="h-4 w-4" /> No
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <NumberField
            value={value}
            onCommit={(v) => {
              setValue(v);
              setTouched(true);
            }}
            min={0}
            decimals={tracker.type !== "count"}
            suffix={tracker.unit ?? undefined}
            suggested={!touched}
            aria-label={`${tracker.name} value`}
          />
          <Button size="sm" disabled={saving} onClick={() => save(value)}>
            {saving ? "…" : "Log"}
          </Button>
        </div>
      )}
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
  const Icon = FOCUS_GROUP_ICON[groupKey];

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
        <Icon className="h-4 w-4 shrink-0 text-primary" />
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

// Session snapshot so the landing page renders instantly on return instead of
// re-running its ~12 queries behind a full skeleton every time.
interface DashboardSnapshot {
  goals: Goal[];
  allGoals: Goal[];
  habits: Habit[];
  habitLogsByHabit: Record<string, HabitLog[]>;
  tasks: Task[];
  sessions: Session[];
  sleepLogs: SleepLog[];
  trackers: Tracker[];
  trackerLogs: TrackerLog[];
  hiddenTrackers: string[];
  waterUnit: string;
  water: number;
  waterTarget: number;
  reviewDoneThisWeek: boolean;
}
let dashboardCache: DashboardSnapshot | null = null;

export default function DashboardPage() {
  const { user, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>(dashboardCache?.goals ?? []);
  const [allGoals, setAllGoals] = useState<Goal[]>(dashboardCache?.allGoals ?? []);
  const [habits, setHabits] = useState<Habit[]>(dashboardCache?.habits ?? []);
  const [habitLogsByHabit, setHabitLogsByHabit] = useState<
    Record<string, HabitLog[]>
  >(dashboardCache?.habitLogsByHabit ?? {});
  const [tasks, setTasks] = useState<Task[]>(dashboardCache?.tasks ?? []);
  const [sessions, setSessions] = useState<Session[]>(dashboardCache?.sessions ?? []);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>(dashboardCache?.sleepLogs ?? []);
  const [trackers, setTrackers] = useState<Tracker[]>(dashboardCache?.trackers ?? []);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>(dashboardCache?.trackerLogs ?? []);
  const [hiddenTrackers, setHiddenTrackers] = useState<string[]>(
    dashboardCache?.hiddenTrackers ?? []
  );
  const [waterUnit, setWaterUnit] = useState<string>(dashboardCache?.waterUnit ?? "glasses");
  const [water, setWater] = useState(dashboardCache?.water ?? 0);
  const [waterTarget, setWaterTarget] = useState(
    dashboardCache?.waterTarget ?? DEFAULT_WATER_TARGET
  );
  const [reviewDoneThisWeek, setReviewDoneThisWeek] = useState(
    dashboardCache?.reviewDoneThisWeek ?? false
  );
  const [loading, setLoading] = useState(!dashboardCache);
  const waterRef = useRef(dashboardCache?.water ?? 0);

  const [stackExpanded, setStackExpanded] = useState(false);
  const [exitingRows, setExitingRows] = useState<Set<string>>(new Set());
  const [logTodayOpen, setLogTodayOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [trackerFormOpen, setTrackerFormOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [completingGoal, setCompletingGoal] = useState<string | null>(null);

  const today = toDateKey(new Date());
  const thisWeekStart = startOfWeekKey(today);

  useEffect(() => {
    try {
      setOnboardingDismissed(
        localStorage.getItem("lifeos:onboardingDismissed") === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);

  // All dashboard data loads in one parallel batch — no request waterfall.
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [g, ag, h, t, logs, sess, sleep, nutrition, review, trk, trkLogs, prefs] =
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
          getTrackers(user.uid),
          getTrackerLogs(user.uid),
          getPrefs(user.uid),
        ]);
      const byHabit: Record<string, HabitLog[]> = {};
      for (const log of logs) {
        (byHabit[log.habitId] ??= []).push(log);
      }
      setGoals(g);
      setAllGoals(ag);
      setHabits(h);
      setTasks(t);
      setHabitLogsByHabit(byHabit);
      setSessions(sess);
      setSleepLogs(sleep);
      setWater(nutrition?.water ?? 0);
      waterRef.current = nutrition?.water ?? 0;
      setWaterTarget(nutrition?.waterTarget ?? DEFAULT_WATER_TARGET);
      setReviewDoneThisWeek(review != null);
      setTrackers(trk);
      setTrackerLogs(trkLogs);
      setHiddenTrackers(prefs.hiddenTrackers);
      setWaterUnit(prefs.waterUnit);
      dashboardCache = {
        goals: g,
        allGoals: ag,
        habits: h,
        habitLogsByHabit: byHabit,
        tasks: t,
        sessions: sess,
        sleepLogs: sleep,
        trackers: trk,
        trackerLogs: trkLogs,
        hiddenTrackers: prefs.hiddenTrackers,
        waterUnit: prefs.waterUnit,
        water: nutrition?.water ?? 0,
        waterTarget: nutrition?.waterTarget ?? DEFAULT_WATER_TARGET,
        reviewDoneThisWeek: review != null,
      };
    } finally {
      setLoading(false);
    }
  }, [user, today, thisWeekStart]);

  useEffect(() => {
    load();
  }, [load]);

  /** Play a collapse animation on a priority row while its action commits. */
  function exitRow(key: string) {
    setExitingRows((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setExitingRows((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1200);
  }

  async function setWaterValue(next: number) {
    if (!user) return;
    const prev = waterRef.current;
    const clamped = Math.max(0, Math.round(next * 100) / 100);
    waterRef.current = clamped;
    setWater(clamped);
    if (clamped >= waterTarget) exitRow("water");
    try {
      await upsertNutritionLog(user.uid, today, { water: clamped });
    } catch {
      waterRef.current = prev;
      setWater(prev);
    }
  }

  async function setWaterTargetValue(next: number) {
    if (!user) return;
    setWaterTarget(next);
    await upsertNutritionLog(user.uid, today, { waterTarget: next });
  }

  async function handleHabitComplete(habit: Habit, done: boolean) {
    if (!user) return;
    // Optimistic local update.
    setHabitLogsByHabit((prev) => {
      const logs = (prev[habit.id] ?? []).filter(
        (l) => l.completedDate !== today
      );
      if (done) {
        logs.push({
          id: `${habit.id}_${today}`,
          habitId: habit.id,
          userId: user.uid,
          completedDate: today,
          value: habit.targetType !== "check" ? habit.targetValue : null,
          note: null,
          createdAt: Date.now(),
        });
      }
      return { ...prev, [habit.id]: logs };
    });
    await toggleHabitLog(
      user.uid,
      habit.id,
      today,
      done,
      habit.targetType !== "check" ? habit.targetValue : null
    );
    setHabits(await getDailyHabits(user.uid));
  }

  async function handleHabitValue(habit: Habit, value: number) {
    if (!user) return;
    setHabitLogsByHabit((prev) => {
      const logs = (prev[habit.id] ?? []).filter(
        (l) => l.completedDate !== today
      );
      if (value > 0) {
        logs.push({
          id: `${habit.id}_${today}`,
          habitId: habit.id,
          userId: user.uid,
          completedDate: today,
          value,
          note: null,
          createdAt: Date.now(),
        });
      }
      return { ...prev, [habit.id]: logs };
    });
    await setHabitLogValue(user.uid, habit.id, today, value);
    setHabits(await getDailyHabits(user.uid));
  }

  async function handleQuickLogSleep(hours: number) {
    if (!user) return;
    exitRow("sleep");
    await upsertSleepLog(user.uid, today, {
      hours,
      quality: sleepDefault.quality,
      notes: null,
    });
    await load();
  }

  async function handleTrackerLog(tracker: Tracker, value: number) {
    if (!user) return;
    if (trackerValueMeetsTarget(tracker, value)) exitRow(`tracker-${tracker.id}`);
    // Optimistic local update.
    setTrackerLogs((prev) => [
      ...prev.filter((l) => !(l.trackerId === tracker.id && l.date === today)),
      {
        id: `${user.uid}_${tracker.id}_${today}`,
        userId: user.uid,
        trackerId: tracker.id,
        date: today,
        value,
      },
    ]);
    await setTrackerLog(user.uid, tracker.id, today, value);
  }

  async function handleQuickCompleteTask(task: Task) {
    await setTaskDone({ id: task.id, goalId: task.goalId }, true);
    await load();
  }

  async function handleCompleteGoalAction(goal: Goal, action: NextAction) {
    setCompletingGoal(goal.id);
    try {
      await completeGoalNextAction(goal, action);
      await load();
    } finally {
      setCompletingGoal(null);
    }
  }

  const greeting = greetingFor(new Date().getHours());
  const GreetingIcon = greetingIconFor(new Date().getHours());
  const name = resolveFirstName(displayName, user?.email);
  const isMonday = new Date().getDay() === 1;

  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length)
      : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak ?? 0), 0);

  // The one active goal that most needs attention today (stale > behind >
  // nearest deadline). Surfaces it on the dashboard instead of on Goals only.
  const urgentGoal = useMemo(() => {
    let best: { id: string; title: string; score: number; reason: string } | null = null;
    for (const g of allGoals) {
      if (g.status !== "active") continue;
      const pace = goalPace(g, today);
      const dtd = daysToDeadline(g, today);
      let score = 0;
      let reason = "";
      if (goalStale(g, today)) {
        score = 1000;
        reason = "no recent progress";
      } else if (pace?.label === "Behind schedule") {
        score = 500;
        reason = "behind schedule";
      } else if (dtd != null && dtd >= 0 && dtd <= 14) {
        score = 200 - dtd;
        reason = dtd === 0 ? "due today" : `due in ${dtd}d`;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { id: g.id, title: g.title, score, reason };
      }
    }
    return best;
  }, [allGoals, today]);

  // Focus goals + their next action — the Goals module's "Today's Momentum",
  // surfaced on the dashboard so the daily driver actually includes your goals.
  const focusMomentum = useMemo(
    () =>
      allGoals
        .filter((g) => g.focus && g.status === "active")
        .map((g) => ({ goal: g, action: goalNextAction(g, tasks) }))
        .filter((x): x is { goal: Goal; action: NextAction } => Boolean(x.action)),
    [allGoals, tasks]
  );

  const lastNight = sleepLogs[0];

  // Done-semantics per habit (count habits are done once value >= target).
  const habitDoneDates = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const h of habits) m[h.id] = doneDates(h, habitLogsByHabit[h.id] ?? []);
    return m;
  }, [habits, habitLogsByHabit]);

  const habitTodayValue = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of habits) {
      const log = (habitLogsByHabit[h.id] ?? []).find(
        (l) => l.completedDate === today
      );
      m[h.id] = log?.value ?? 0;
    }
    return m;
  }, [habits, habitLogsByHabit, today]);

  const habitsDoneToday = habits.filter((h) =>
    (habitDoneDates[h.id] ?? []).includes(today)
  ).length;
  const habitsRemaining = habits.filter(
    (h) => !(habitDoneDates[h.id] ?? []).includes(today)
  );

  // Sleep trend: last night vs the 7-day average — only shown with 2+ points.
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

  const habitStrip = useMemo(() => {
    if (habits.length === 0) return [];
    return lastNDays(today, 7).map((d) => {
      const done = habits.filter((h) =>
        (habitDoneDates[h.id] ?? []).includes(d)
      ).length;
      return { date: d, ratio: done / habits.length, done };
    });
  }, [habits, habitDoneDates, today]);

  const visibleTrackers = useMemo(
    () => trackers.filter((t) => !t.archived && !hiddenTrackers.includes(t.id)),
    [trackers, hiddenTrackers]
  );
  const trackerLoggedToday = useMemo(() => {
    const s = new Set(
      trackerLogs.filter((l) => l.date === today).map((l) => l.trackerId)
    );
    return s;
  }, [trackerLogs, today]);
  const trackersDue = useMemo(
    () => visibleTrackers.filter((t) => !trackerLoggedToday.has(t.id)),
    [visibleTrackers, trackerLoggedToday]
  );

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
        trackersDue,
        tasksDueToday,
        nextSession,
        hiddenTrackers,
      }),
    [
      isMonday,
      reviewDoneThisWeek,
      sleepLogs,
      habitsRemaining,
      habits.length,
      water,
      waterTarget,
      trackersDue,
      tasksDueToday,
      nextSession,
      hiddenTrackers,
      today,
    ]
  );
  const visibleStack = priorityStack.slice(0, 4);
  const overflowStack = priorityStack.slice(4);

  function rowKey(item: PriorityItem): string {
    return item.kind === "tracker" ? `tracker-${item.tracker.id}` : item.kind;
  }

  function renderPriorityItem(item: PriorityItem) {
    const key = rowKey(item);
    let content: ReactNode = null;
    switch (item.kind) {
      case "monday":
        content = (
          <LinkPriorityRow
            icon={CalendarCheck}
            title="It's Monday — review last week"
            detail="Reflect on wins, blockers, and set this week's focus."
            href="/review"
          />
        );
        break;
      case "sleep":
        content = (
          <SleepPriorityRow
            defaultHours={sleepDefault.hours}
            onLog={handleQuickLogSleep}
          />
        );
        break;
      case "habits":
        content = (
          <HabitsPriorityRow
            remaining={item.remaining}
            total={item.total}
            onComplete={(h) => handleHabitComplete(h, true)}
          />
        );
        break;
      case "water":
        content = (
          <WaterPriorityRow
            water={water}
            waterTarget={waterTarget}
            waterUnit={waterUnit}
            onAdjust={(d) => setWaterValue(waterRef.current + d)}
            onSet={setWaterValue}
            onSetTarget={setWaterTargetValue}
          />
        );
        break;
      case "tracker":
        content = (
          <TrackerPriorityRow
            tracker={item.tracker}
            onLog={(v) => handleTrackerLog(item.tracker, v)}
          />
        );
        break;
      case "tasks":
        content = (
          <TasksDuePriorityRow
            due={item.due}
            onToggle={handleQuickCompleteTask}
          />
        );
        break;
      case "session": {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const mins = item.session.startMin - nowMinutes;
        const detail =
          mins <= 60
            ? `starts in ${Math.max(0, mins)} min`
            : `at ${minToLabel(item.session.startMin)}`;
        content = (
          <LinkPriorityRow
            icon={CalendarClock}
            title={`Up next: ${item.session.title}`}
            detail={detail}
            href="/sessions"
          />
        );
        break;
      }
    }
    return (
      <div key={key} className={cn(exitingRows.has(key) && "animate-collapse-out")}>
        {content}
      </div>
    );
  }

  // Today's Focus: open tasks + tasks completed today, grouped by the
  // category of their linked goal (or "Other").
  const categoryById = useMemo(() => {
    const m = new Map<string, string | null>();
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
      const key: FocusGroupKey =
        cat && (FOCUS_GROUP_ORDER as string[]).includes(cat)
          ? (cat as FocusGroupKey)
          : "other";
      groups.get(key)!.push(t);
    }
    return FOCUS_GROUP_ORDER.map((key) => ({
      key,
      tasks: groups.get(key) ?? [],
    })).filter((g) => g.tasks.length > 0);
  }, [openTasksSorted, todayCompletedTasks, categoryById]);

  const hasAnythingToLog =
    (!sleepLogs.some((s) => s.date === today) && !hiddenTrackers.includes("sleep")) ||
    (water < waterTarget && !hiddenTrackers.includes("water")) ||
    (habitsRemaining.length > 0 && !hiddenTrackers.includes("habits")) ||
    trackersDue.length > 0;

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
              ? `Water: ${water}/${waterTarget}`
              : top.kind === "tracker"
                ? `Log ${top.tracker.name}`
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
      if (taskFormOpen || goalFormOpen || logTodayOpen || habitFormOpen || trackerFormOpen) return;
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
  }, [taskFormOpen, goalFormOpen, logTodayOpen, habitFormOpen, trackerFormOpen, hasAnythingToLog]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <SkeletonCard lines={4} />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard lines={5} className="lg:col-span-2" />
          <SkeletonCard lines={5} />
        </div>
      </div>
    );
  }

  const statsAreEmpty = goals.length === 0 && bestStreak === 0;
  const showOnboarding =
    !onboardingDismissed &&
    allGoals.length === 0 &&
    habits.length === 0 &&
    tasks.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Greeting */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/12 via-card to-card p-6 md:p-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
          <GreetingIcon className="h-7 w-7 text-primary" />
          {greeting}, {name}!
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
            <DropdownMenuItem onClick={() => setHabitFormOpen(true)}>
              New habit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTrackerFormOpen(true)}>
              New tracker
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

      {/* Consolidated first-run onboarding (replaces four separate nudges) */}
      {showOnboarding && (
        <Card className="animate-fade-slide-in border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="font-medium">Let&apos;s set up your Life OS</p>
              </div>
              <button
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setOnboardingDismissed(true);
                  try {
                    localStorage.setItem("lifeos:onboardingDismissed", "1");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with one goal, one task, or one habit — the dashboard fills
              in as you go.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setGoalFormOpen(true)}>
                <Target className="h-4 w-4" /> Add a goal
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTaskFormOpen(true)}>
                <CheckSquare className="h-4 w-4" /> Add a task
              </Button>
              <Button size="sm" variant="outline" onClick={() => setHabitFormOpen(true)}>
                <Flame className="h-4 w-4" /> Add a habit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Momentum — the next step on each focus goal (from the Goals module) */}
      {focusMomentum.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Momentum</span>
              <span className="text-xs text-muted-foreground">· your focus goals</span>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link href="/goals">Goals</Link>
              </Button>
            </div>
            <div className="divide-y">
              {focusMomentum.map(({ goal, action }) => {
                const busy = completingGoal === goal.id;
                const m = goalMomentum(goal, today);
                return (
                  <div key={goal.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCompleteGoalAction(goal, action)}
                      aria-label="Mark done"
                      className="group shrink-0 transition-colors disabled:opacity-50"
                    >
                      <Circle className="h-5 w-5 text-muted-foreground/50 group-hover:hidden" />
                      <CheckCircle2 className="hidden h-5 w-5 text-emerald-500 group-hover:block" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", busy && "opacity-50")}>
                        {action.title}
                      </p>
                      <Link
                        href={`/goals/${goal.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {goal.icon && <span aria-hidden>{goal.icon}</span>}
                        <span className="truncate">{goal.title}</span>
                      </Link>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <MomentumChip m={m} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority stack */}
      {priorityStack.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Priority stack</span>
            </div>
            <div className="divide-y">{visibleStack.map(renderPriorityItem)}</div>
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
                    {overflowStack.map(renderPriorityItem)}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat tiles (hidden when there's no meaningful data yet) */}
      {statsAreEmpty ? (
        !showOnboarding && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Your stats will show up here once you&apos;ve logged a few days.
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Target}
            label="Active goals"
            value={<AnimatedNumber value={goals.length} />}
          >
            {urgentGoal && (
              <Link
                href={`/goals/${urgentGoal.id}`}
                className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs transition-colors hover:bg-amber-500/20"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{urgentGoal.title}</span> —{" "}
                  {urgentGoal.reason}
                </span>
              </Link>
            )}
            {goals.length === 0 ? (
              <p className="text-muted-foreground">
                No active goals.{" "}
                <Link href="/goals" className="text-primary hover:underline">
                  Add one
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => {
                  const Icon =
                    (g.category &&
                      GOAL_CATEGORY_ICON[
                        g.category as keyof typeof GOAL_CATEGORY_ICON
                      ]) ||
                    Target;
                  return (
                    <div key={g.id} className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="flex-1 truncate">{g.title}</span>
                      <span className="text-muted-foreground">
                        {g.measurement === "count" && g.targetValue
                          ? `${g.currentValue ?? 0}/${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`
                          : `${g.progress}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </StatTile>

          <StatTile
            icon={TrendingUp}
            label="Avg progress"
            value={<AnimatedNumber value={avgProgress} format={(n) => `${n}%`} />}
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

          <StatTile
            icon={Flame}
            label="Best streak"
            value={<AnimatedNumber value={bestStreak} format={(n) => `${n}d`} />}
          >
            {habits.length === 0 ? (
              <p className="text-muted-foreground">No habits yet.</p>
            ) : (
              <div className="space-y-1.5">
                {[...habits]
                  .sort((a, b) => (b.bestStreak ?? 0) - (a.bestStreak ?? 0))
                  .slice(0, 6)
                  .map((h) => {
                    const Icon = (h.category && HABIT_CATEGORY_ICON[h.category as HabitCategory]) || Flame;
                    return (
                      <div key={h.id} className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="flex-1 truncate">{h.title}</span>
                        <span className="text-muted-foreground">
                          {h.bestStreak}d
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </StatTile>

          <StatTile
            icon={Moon}
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

          {/* Custom trackers as equal-citizen stat tiles */}
          {visibleTrackers.map((t) => {
            const Icon = trackerIcon(t.icon);
            const logs = trackerLogs
              .filter((l) => l.trackerId === t.id)
              .sort((a, b) => (a.date < b.date ? 1 : -1));
            const todayLog = logs.find((l) => l.date === today);
            return (
              <StatTile
                key={t.id}
                icon={Icon}
                label={t.name}
                value={
                  todayLog ? formatTrackerValue(t, todayLog.value) : "—"
                }
              >
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">Nothing logged yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.slice(0, 5).map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-muted-foreground">
                          {l.date}
                        </span>
                        <span>{formatTrackerValue(t, l.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </StatTile>
            );
          })}
        </div>
      )}

      {/* Bento grid */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Today's Focus — grouped by category, collapsible per group */}
        {!(showOnboarding && focusGroups.length === 0) && (
          <CollapsibleSection
            id="focus"
            icon={ClipboardList}
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
        )}

        {/* Active Goals */}
        {!(showOnboarding && goals.length === 0) && (
          <CollapsibleSection
            id="goals"
            icon={Target}
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
                {goals.map((goal) => {
                  const Icon =
                    (goal.category &&
                      GOAL_CATEGORY_ICON[
                        goal.category as keyof typeof GOAL_CATEGORY_ICON
                      ]) ||
                    Target;
                  return (
                    <Link
                      key={goal.id}
                      href={`/goals/${goal.id}`}
                      className="card-interactive animate-fade-slide-in rounded-xl border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="flex-1 truncate text-sm font-medium">
                          {goal.title}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {goal.measurement === "count" && goal.targetValue
                            ? `${goal.currentValue ?? 0}/${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""}`
                            : "Progress"}
                        </span>
                        <span className="font-medium text-foreground">
                          {goal.progress}%
                        </span>
                      </div>
                      <Progress value={goal.progress} className="mt-1" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Habits */}
        {!(showOnboarding && habits.length === 0) && (
          <CollapsibleSection
            id="habits"
            icon={Flame}
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
                      state={habitStateFromDates(habitDoneDates[h.id] ?? [], today)}
                      todayValue={habitTodayValue[h.id] ?? 0}
                      onToggle={(done) => handleHabitComplete(h, done)}
                      onSetValue={(v) => handleHabitValue(h, v)}
                      showWeek={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Today's Schedule */}
        {sessions.length > 0 && (
          <CollapsibleSection
            id="schedule"
            icon={CalendarClock}
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
            waterUnit={waterUnit}
            habitsRemaining={habitsRemaining}
            trackersDue={trackersDue}
            hiddenTrackers={hiddenTrackers}
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
          <HabitFormDialog
            open={habitFormOpen}
            onOpenChange={setHabitFormOpen}
            userId={user.uid}
            onSaved={load}
          />
          <TrackerFormDialog
            open={trackerFormOpen}
            onOpenChange={setTrackerFormOpen}
            userId={user.uid}
            nextSortOrder={trackers.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1}
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
