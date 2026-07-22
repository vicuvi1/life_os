"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Flame,
  Plus,
  Check,
  Clock,
  Copy,
  Palette,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  BarChart3,
  Archive,
  ArchiveRestore,
  StickyNote,
  LayoutTemplate,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getHabits,
  getHabitLogs,
  toggleHabitLog,
  createHabit,
  updateHabit,
  deleteHabit,
  reorderHabits,
} from "@/lib/firebase/db";
import {
  dayStatus,
  tallyStatuses,
  lastNDays,
  addDays,
  doneDates,
  isLogDone,
  habitCurrentStreak,
  habitLongestStreak,
  streakMilestoneMessage,
  categoryLabel,
  HABIT_CATEGORIES,
  DEFAULT_HABIT_COLOR,
  DIFFICULTY_META,
  type DayStatus,
} from "@/lib/habits";
import { HabitStatsDialog } from "@/components/habits/habit-stats-dialog";
import { TemplatesDialog } from "@/components/habits/templates-dialog";
import { DayEditorDialog } from "@/components/habits/day-editor-dialog";
import { IconColorDialog } from "@/components/habits/icon-color-dialog";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HabitFormDialog } from "@/components/habits/habit-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/lib/types";

const WINDOW = 28; // 4 weeks
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDay(key: string): { wd: string; day: number; month: string } {
  const d = new Date(key + "T00:00:00");
  return { wd: WEEK_HEADS[(d.getDay() + 6) % 7], day: d.getDate(), month: MONTHS_SHORT[d.getMonth()] };
}
function rangeLabel(first: string, last: string): string {
  const a = fmtDay(first);
  const b = fmtDay(last);
  return `${a.day} ${a.month} – ${b.day} ${b.month}`;
}
function cellTitle(key: string, status: DayStatus, log?: { value: number | null; note: string | null; createdAt: number }): string {
  const d = fmtDay(key);
  const word = status === "completed" ? "Completed" : status === "partial" ? "Partial" : status === "missed" ? "Missed" : "Not done";
  const parts = [`${d.day} ${d.month}`, word];
  if (log?.value != null) parts.push(String(log.value));
  if (log?.createdAt) parts.push(new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  if (log?.note) parts.push(log.note);
  return parts.join("  ·  ");
}
function monthKeysOf(anchorKey: string): { keys: string[]; label: string } {
  const d = new Date(anchorKey + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const keys: string[] = [];
  for (let i = 1; i <= dim; i++) keys.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  return { keys, label: `${MONTHS_SHORT[m]} ${y}` };
}

export default function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByHabit, setLogsByHabit] = useState<Record<string, HabitLog[]>>({});
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [statsHabit, setStatsHabit] = useState<Habit | null>(null);
  const [quickName, setQuickName] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{ habit: Habit; date: string } | null>(null);
  const [poppedCell, setPoppedCell] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ message: string; habit: string } | null>(null);
  const [appearanceId, setAppearanceId] = useState<string | null>(null);

  const [windowOffset, setWindowOffset] = useState(0); // 0 = current window (ends today)
  const [windowDays, setWindowDays] = useState(WINDOW);
  const [weekStart, setWeekStart] = useState<"mon" | "sun">("mon");
  const [viewMode, setViewMode] = useState<"table" | "cards" | "compact" | "calendar">("table");
  const [dragHabit, setDragHabit] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const today = toDateKey(new Date());

  // Load & persist tracker preferences (per device).
  useEffect(() => {
    try {
      const w = Number(window.localStorage.getItem("habits:windowDays"));
      if ([14, 28, 56, 84].includes(w)) setWindowDays(w);
      const v = window.localStorage.getItem("habits:viewMode");
      if (v === "table" || v === "cards" || v === "compact" || v === "calendar") setViewMode(v);
      const ws = window.localStorage.getItem("habits:weekStart");
      if (ws === "mon" || ws === "sun") setWeekStart(ws);
      if (window.localStorage.getItem("habits:showNumbers") === "1") setShowNumbers(true);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("habits:windowDays", String(windowDays));
      window.localStorage.setItem("habits:viewMode", viewMode);
      window.localStorage.setItem("habits:weekStart", weekStart);
      window.localStorage.setItem("habits:showNumbers", showNumbers ? "1" : "0");
    } catch {
      // ignore
    }
  }, [windowDays, viewMode, weekStart, showNumbers]);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [h, logs] = await Promise.all([getHabits(user.uid), getHabitLogs(user.uid)]);
      const byHabit: Record<string, HabitLog[]> = {};
      for (const log of logs) (byHabit[log.habitId] ??= []).push(log);
      setHabits(h);
      setLogsByHabit(byHabit);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(null), 4500);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  const logMap = useMemo(() => {
    const m = new Map<string, Map<string, HabitLog>>();
    for (const [hid, logs] of Object.entries(logsByHabit)) {
      const inner = new Map<string, HabitLog>();
      for (const l of logs) inner.set(l.completedDate, l);
      m.set(hid, inner);
    }
    return m;
  }, [logsByHabit]);

  // Window end is derived from the LIVE today, so it never goes stale at midnight.
  const anchorEnd = useMemo(() => addDays(today, -windowOffset * windowDays), [today, windowOffset, windowDays]);
  const keys = useMemo(() => lastNDays(anchorEnd, windowDays), [anchorEnd, windowDays]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const archivedCount = habits.length - activeHabits.length;

  const filteredHabits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return habits
      .filter((h) => {
        if (!showArchived && h.archived) return false;
        if (filterCategory !== "all" && h.category !== filterCategory) return false;
        if (!q) return true;
        return (
          h.title.toLowerCase().includes(q) ||
          (h.tags ?? []).some((t) => t.includes(q)) ||
          (h.description ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }, [habits, filterCategory, search, showArchived]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(HABIT_CATEGORIES);
    for (const h of habits) if (h.category) set.add(h.category);
    return Array.from(set);
  }, [habits]);

  // Per-habit cells + tally for the current window.
  const grid = useMemo(() => {
    return filteredHabits.map((h) => {
      const createdKey = toDateKey(new Date(h.createdAt));
      const perDate = logMap.get(h.id) ?? new Map<string, HabitLog>();
      const cells = keys.map((k) => {
        const log = perDate.get(k);
        return { key: k, log, status: dayStatus(h, log, k, today, createdKey) };
      });
      const tally = tallyStatuses(cells.map((c) => c.status));
      return { habit: h, cells, tally };
    });
  }, [filteredHabits, logMap, keys, today]);

  const allTally = useMemo(() => tallyStatuses(grid.flatMap((g) => g.cells.map((c) => c.status))), [grid]);

  // Streaks computed live from logs (so toggling updates instantly, no refetch).
  const streaksByHabit = useMemo(() => {
    const m = new Map<string, { streak: number; best: number }>();
    for (const h of habits) {
      const done = doneDates(h, logsByHabit[h.id] ?? []);
      m.set(h.id, { streak: habitCurrentStreak(h, done, today), best: habitLongestStreak(h, done) });
    }
    return m;
  }, [habits, logsByHabit, today]);
  const topStreak = useMemo(() => {
    let top: { habit: Habit; streak: number } | null = null;
    for (const h of filteredHabits) {
      const s = streaksByHabit.get(h.id)?.streak ?? 0;
      if (!top || s > top.streak) top = { habit: h, streak: s };
    }
    return top;
  }, [filteredHabits, streaksByHabit]);

  const weekday = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ completed: 0, scheduled: 0 }));
    for (const g of grid)
      for (const c of g.cells) {
        if (c.status === "none") continue;
        const wd = new Date(c.key + "T00:00:00").getDay();
        acc[wd].scheduled++;
        if (c.status === "completed") acc[wd].completed++;
      }
    return acc;
  }, [grid]);

  const bestStreaks = useMemo(
    () =>
      [...habits]
        .map((h) => ({ habit: h, best: streaksByHabit.get(h.id)?.best ?? 0 }))
        .filter((x) => x.best > 0)
        .sort((a, b) => b.best - a.best)
        .slice(0, 5),
    [habits, streaksByHabit]
  );

  // 365-day heatmap data (independent of the 4-week grid window).
  const yearKeys = useMemo(() => lastNDays(today, 365), [today]);
  const yearHeat = useMemo(() => {
    const m = new Map<string, { completed: number; scheduled: number }>();
    for (const k of yearKeys) m.set(k, { completed: 0, scheduled: 0 });
    for (const h of filteredHabits) {
      const createdKey = toDateKey(new Date(h.createdAt));
      const perDate = logMap.get(h.id) ?? new Map<string, HabitLog>();
      for (const k of yearKeys) {
        const st = dayStatus(h, perDate.get(k), k, today, createdKey);
        if (st === "none") continue;
        const e = m.get(k)!;
        e.scheduled++;
        if (st === "completed") e.completed++;
      }
    }
    return m;
  }, [filteredHabits, logMap, yearKeys, today]);

  // Today summary (hero): completed count, what's left, and rough time remaining.
  const remainingToday = useMemo(
    () =>
      activeHabits.filter((h) => {
        const log = logMap.get(h.id)?.get(today);
        return !(log && isLogDone(h, log));
      }),
    [activeHabits, logMap, today]
  );
  const doneToday = activeHabits.length - remainingToday.length;
  const todayPct = activeHabits.length > 0 ? (doneToday / activeHabits.length) * 100 : 0;
  const timeLeftMin = useMemo(
    () => remainingToday.reduce((s, h) => s + (h.targetType === "duration" && h.targetValue ? h.targetValue : 5), 0),
    [remainingToday]
  );

  async function setArchived(habit: Habit, archived: boolean) {
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, archived } : h)));
    try {
      await updateHabit(habit.id, { archived });
    } catch {
      await load({ quiet: true });
    }
  }

  function applyAppearance(patch: { emoji?: string | null; color?: string }) {
    if (!user || !appearanceId) return;
    setHabits((prev) => prev.map((h) => (h.id === appearanceId ? { ...h, ...patch } : h)));
    void updateHabit(appearanceId, patch).catch(() => void load({ quiet: true }));
  }

  async function duplicateHabit(habit: Habit) {
    if (!user) return;
    try {
      await createHabit(user.uid, {
        title: `${habit.title} (copy)`,
        description: habit.description,
        emoji: habit.emoji,
        tags: habit.tags,
        frequency: habit.frequency,
        category: habit.category,
        color: habit.color,
        targetType: habit.targetType,
        targetValue: habit.targetValue,
        difficulty: habit.difficulty,
        archived: false,
      });
      await load({ quiet: true });
    } catch {
      await load({ quiet: true });
    }
  }

  async function moveHabit(habit: Habit, dir: -1 | 1) {
    const list = filteredHabits;
    const i = list.findIndex((h) => h.id === habit.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i];
    const b = list[j];
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    setHabits((prev) => prev.map((h) => (h.id === a.id ? { ...h, sortOrder: bOrder } : h.id === b.id ? { ...h, sortOrder: aOrder } : h)));
    try {
      await Promise.all([updateHabit(a.id, { sortOrder: bOrder }), updateHabit(b.id, { sortOrder: aOrder })]);
    } catch {
      await load({ quiet: true });
    }
  }

  /** Drag reorder: move `fromId` to `toId`'s position and persist the new order. */
  async function reorderHabit(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ordered = [...habits].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt
    );
    const from = ordered.findIndex((h) => h.id === fromId);
    const to = ordered.findIndex((h) => h.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const next = ordered.map((h, i) => ({ ...h, sortOrder: i }));
    setHabits(next); // optimistic
    try {
      await reorderHabits(next.map((h) => h.id));
    } catch {
      load({ quiet: true });
    }
  }

  // Instant, flicker-free toggle: update local state synchronously and write to
  // Firestore in the background (idempotent deterministic doc id). No refetch —
  // streaks/KPIs are derived live from local logs, so nothing "blips".
  function toggleCell(habit: Habit, key: string, status: DayStatus) {
    if (!user || key > today) return;
    const done = status !== "completed";
    const fullValue = (habit.targetType ?? "check") !== "check" ? habit.targetValue : null;
    setLogsByHabit((prev) => {
      const logs = (prev[habit.id] ?? []).filter((l) => l.completedDate !== key);
      if (done) logs.push({ id: `${habit.id}_${key}`, habitId: habit.id, userId: user.uid, completedDate: key, value: fullValue, note: null, createdAt: Date.now() });
      return { ...prev, [habit.id]: logs };
    });
    if (done) {
      // Satisfying pop on the cell we just completed.
      const cellId = `${habit.id}:${key}`;
      setPoppedCell(cellId);
      window.setTimeout(() => setPoppedCell((p) => (p === cellId ? null : p)), 500);
      // Celebrate when this completion reaches a streak milestone.
      const doneSet = new Set(doneDates(habit, logsByHabit[habit.id] ?? []));
      doneSet.add(key);
      const msg = streakMilestoneMessage(habitCurrentStreak(habit, Array.from(doneSet), today));
      if (msg) setCelebrate({ message: msg, habit: habit.emoji ? `${habit.emoji} ${habit.title}` : habit.title });
    }
    void toggleHabitLog(user.uid, habit.id, key, done, fullValue).catch(() => {
      void load({ quiet: true }); // reconcile silently — never flash the skeleton
    });
  }

  async function quickAdd() {
    const name = quickName.trim();
    if (!user || !name) return;
    setQuickName("");
    try {
      await createHabit(user.uid, {
        title: name, description: null, emoji: null, tags: [],
        frequency: "daily", category: "morning", color: DEFAULT_HABIT_COLOR,
        targetType: "check", targetValue: null, difficulty: "medium", archived: false,
      });
      await load();
    } catch {
      await load();
    }
  }

  function shiftWindow(delta: number) {
    // delta -1 = older window, +1 = newer; offset can't go below 0 (today).
    setWindowOffset((o) => Math.max(0, o - delta));
  }
  const atToday = windowOffset === 0;

  // Week-start-aware helpers (display only; streak math stays Monday-based).
  const weekdayOrder = weekStart === "mon" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const weekHeadLabels = weekStart === "mon" ? WEEK_HEADS : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startOffset = (dateKey: string) => {
    const d = new Date(dateKey + "T00:00:00").getDay();
    return weekStart === "mon" ? (d + 6) % 7 : d;
  };

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const renderMenu = (habit: Habit) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Habit menu"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setStatsHabit(habit)}><BarChart3 className="h-4 w-4" /> Statistics</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setNoteTarget({ habit, date: today })}><StickyNote className="h-4 w-4" /> Edit today</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setEditing(habit); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit habit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAppearanceId(habit.id)}><Palette className="h-4 w-4" /> Emoji &amp; color</DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicateHabit(habit)}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveHabit(habit, -1)}><ArrowUp className="h-4 w-4" /> Move up</DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveHabit(habit, 1)}><ArrowDown className="h-4 w-4" /> Move down</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setArchived(habit, !habit.archived)}>
          {habit.archived ? <><ArchiveRestore className="h-4 w-4" /> Unarchive</> : <><Archive className="h-4 w-4" /> Archive</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDeleting(habit)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {celebrate && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2">
          <div className="animate-celebrate rounded-2xl border border-amber-500/40 bg-card/95 px-5 py-3 text-center shadow-xl backdrop-blur">
            <p className="text-2xl">🎉🔥🎉</p>
            <p className="mt-1 text-sm font-semibold">{celebrate.message}</p>
            <p className="text-xs text-muted-foreground">{celebrate.habit}</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">My Habits</h1>
          <p className="text-muted-foreground">
            {activeHabits.length > 0 ? `${doneToday}/${activeHabits.length} done today — small daily actions, big life changes.` : "Small daily actions, big life changes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-background">
            <Button variant="ghost" size="icon" aria-label="Previous 4 weeks" onClick={() => shiftWindow(-1)} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-sm font-medium">{keys.length > 0 ? rangeLabel(keys[0], keys[keys.length - 1]) : ""}</span>
            <Button variant="ghost" size="icon" aria-label="Next window" onClick={() => shiftWindow(1)} disabled={atToday} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={String(windowDays)} onValueChange={(v) => { setWindowDays(Number(v)); setWindowOffset(0); }}>
            <SelectTrigger className="h-9 w-[104px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14">2 weeks</SelectItem>
              <SelectItem value="28">4 weeks</SelectItem>
              <SelectItem value="56">8 weeks</SelectItem>
              <SelectItem value="84">12 weeks</SelectItem>
            </SelectContent>
          </Select>
          {user && (
            <>
              <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplate className="h-4 w-4" /> Templates
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add habit
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
      ) : habits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Flame className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No habits yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add habits like Drink 2L of water, Meditate, or Read 20 pages — give each an emoji and tags, then check them off to build streaks.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add your first habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Today hero summary */}
          <Card className="overflow-hidden">
            <div className="grid gap-5 p-5 lg:grid-cols-[1.45fr_1fr]">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-bold tabular-nums">{doneToday} / {activeHabits.length}</span>
                  <span className="pb-1 text-sm text-muted-foreground">habits complete · {Math.round(todayPct)}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(2, todayPct)}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500"><Clock className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Est. time left</p>
                      <p className="font-semibold tabular-nums">{remainingToday.length === 0 ? "Done 🎉" : `~${timeLeftMin} min`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500"><Flame className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Longest streak</p>
                      <p className="truncate font-semibold">
                        {topStreak && topStreak.streak > 0 ? `${topStreak.habit.emoji ? topStreak.habit.emoji + " " : ""}${topStreak.habit.title} · ${topStreak.streak}d` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining today</p>
                {remainingToday.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">All done for today 🎉</p>
                ) : (
                  <ul className="max-h-44 space-y-1 overflow-y-auto">
                    {remainingToday.map((h) => {
                      const c = h.color ?? DEFAULT_HABIT_COLOR;
                      const st = dayStatus(h, logMap.get(h.id)?.get(today), today, today, toDateKey(new Date(h.createdAt)));
                      return (
                        <li key={h.id}>
                          <button onClick={() => toggleCell(h, today, st)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-accent">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm" style={{ backgroundColor: `${c}22` }}>
                              {h.emoji || <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{h.title}</span>
                            <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2">
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All habits</SelectItem>
                {categoryOptions.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search name or tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 min-w-[150px] flex-1" />
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="cards">Cards</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={weekStart} onValueChange={(v) => setWeekStart(v as "mon" | "sun")}>
              <SelectTrigger className="h-9 w-[116px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mon">Week: Mon</SelectItem>
                <SelectItem value="sun">Week: Sun</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Show numbers
            </label>
            {archivedCount > 0 && (
              <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-input" />
                Show archived ({archivedCount})
              </label>
            )}
          </div>

          {/* Grid */}
          <Card className="overflow-hidden">
            {grid.length === 0 ? (
              <CardContent className="p-10 text-center text-sm text-muted-foreground">No habits match this filter.</CardContent>
            ) : viewMode === "table" ? (
              <div className="max-h-[68vh] overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className="border-b">
                      <th className="sticky left-0 z-30 bg-card px-3 py-2 text-left align-bottom">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Habit</span>
                      </th>
                      {keys.map((k) => {
                        const { wd, day } = fmtDay(k);
                        const isToday = k === today;
                        return (
                          <th key={k} className={cn("w-[44px] px-0 py-2 text-center align-bottom", isToday && "bg-primary/5 text-primary")}>
                            <div className="text-[10px] uppercase text-muted-foreground">{wd[0]}</div>
                            <div className={cn("text-xs tabular-nums", isToday ? "font-bold text-primary" : "text-muted-foreground")}>{day}</div>
                          </th>
                        );
                      })}
                      <th className="w-[120px] px-2 py-1 text-right align-bottom">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map(({ habit, cells, tally }) => {
                      const color = habit.color ?? DEFAULT_HABIT_COLOR;
                      const streak = streaksByHabit.get(habit.id)?.streak ?? 0;
                      const best = streaksByHabit.get(habit.id)?.best ?? 0;
                      const unit = (habit.frequency ?? "daily") === "weekly" ? "w" : "d";
                      return (
                        <tr
                          key={habit.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragHabit) reorderHabit(dragHabit, habit.id);
                            setDragHabit(null);
                          }}
                          className={cn(
                            "group border-b last:border-0 hover:bg-accent/30",
                            habit.archived && "opacity-50",
                            dragHabit === habit.id && "opacity-40"
                          )}
                        >
                          <td
                            draggable
                            onDragStart={() => setDragHabit(habit.id)}
                            onDragEnd={() => setDragHabit(null)}
                            className="sticky left-0 z-10 bg-card px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden
                                title="Drag to reorder"
                                className="-ml-1 shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                              >
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <button
                                type="button"
                                onClick={() => setAppearanceId(habit.id)}
                                title="Change emoji & color"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base transition hover:ring-2 hover:ring-ring"
                                style={{ backgroundColor: `${color}22` }}
                              >
                                {habit.emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DIFFICULTY_META[habit.difficulty].color }} title={`${DIFFICULTY_META[habit.difficulty].label} difficulty`} />
                                  <span className="truncate text-sm font-medium">{habit.title}</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span
                                    className={cn("flex shrink-0 items-center gap-0.5 text-xs font-semibold", streak > 0 ? "text-orange-500" : "text-muted-foreground")}
                                    title={`Current run without missing · best ${best}${unit}`}
                                  >
                                    <Flame className="h-3 w-3" /> {streak}{unit}
                                  </span>
                                  {(habit.tags ?? []).slice(0, 2).map((t) => (
                                    <span key={t} className="rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">{t}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          {cells.map((c) => (
                            <td key={c.key} className={cn("p-1 text-center", c.key === today && "bg-primary/5")}>
                              <StatusCell
                                status={c.status}
                                color={color}
                                value={c.log?.value ?? null}
                                showNumber={showNumbers && (habit.targetType ?? "check") !== "check"}
                                disabled={c.key > today}
                                hasNote={Boolean(c.log?.note)}
                                animate={poppedCell === `${habit.id}:${c.key}`}
                                title={cellTitle(c.key, c.status, c.log)}
                                onClick={() => toggleCell(habit, c.key, c.status)}
                                onNote={() => setNoteTarget({ habit, date: c.key })}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(tally.rate)}%`, backgroundColor: color }} />
                              </div>
                              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(tally.rate)}%</span>
                              {renderMenu(habit)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "compact" ? (
              <div className="divide-y">
                {grid.map(({ habit, cells, tally }) => {
                  const color = habit.color ?? DEFAULT_HABIT_COLOR;
                  const streak = streaksByHabit.get(habit.id)?.streak ?? 0;
                  const recent = cells.slice(-14);
                  return (
                    <div key={habit.id} className={cn("flex items-center gap-3 px-4 py-2.5", habit.archived && "opacity-50")}>
                      <button
                        type="button"
                        onClick={() => setAppearanceId(habit.id)}
                        title="Change emoji & color"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base transition hover:ring-2 hover:ring-ring"
                        style={{ backgroundColor: `${color}22` }}
                      >
                        {habit.emoji || <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DIFFICULTY_META[habit.difficulty].color }} />
                          {habit.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{Math.round(tally.rate)}%{(habit.tags ?? []).length > 0 ? ` · ${habit.tags.slice(0, 2).join(", ")}` : ""}</p>
                      </div>
                      <div className="hidden items-center gap-0.5 md:flex">
                        {recent.map((c) => (
                          <StatusCell key={c.key} status={c.status} color={color} value={c.log?.value ?? null} showNumber={false} disabled={c.key > today} hasNote={Boolean(c.log?.note)} animate={poppedCell === `${habit.id}:${c.key}`} title={cellTitle(c.key, c.status, c.log)} onClick={() => toggleCell(habit, c.key, c.status)} onNote={() => setNoteTarget({ habit, date: c.key })} />
                        ))}
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-500"><Flame className="h-3.5 w-3.5" />{streak}</span>
                      {renderMenu(habit)}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === "cards" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {grid.map(({ habit, cells, tally }) => {
                  const color = habit.color ?? DEFAULT_HABIT_COLOR;
                  const streak = streaksByHabit.get(habit.id)?.streak ?? 0;
                  const todayCell = cells.find((c) => c.key === today);
                  const doneTodayCard = todayCell?.status === "completed";
                  return (
                    <div key={habit.id} className={cn("rounded-2xl border bg-background p-4", habit.archived && "opacity-50")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAppearanceId(habit.id)}
                            title="Change emoji & color"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition hover:ring-2 hover:ring-ring"
                            style={{ backgroundColor: `${color}22` }}
                          >
                            {habit.emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                          </button>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{habit.title}</p>
                            <p className="text-xs text-muted-foreground">{DIFFICULTY_META[habit.difficulty].label} · 🔥 {streak}</p>
                          </div>
                        </div>
                        {renderMenu(habit)}
                      </div>
                      {(habit.tags ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {habit.tags.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold tabular-nums">{Math.round(tally.rate)}%</p>
                          <p className="text-xs text-muted-foreground">this period</p>
                        </div>
                        <Button
                          size="sm"
                          variant={doneTodayCard ? "default" : "outline"}
                          onClick={() => todayCell && toggleCell(habit, today, todayCell.status)}
                          style={doneTodayCard ? { backgroundColor: color, borderColor: color } : undefined}
                        >
                          {doneTodayCard ? <><Check className="h-4 w-4" /> Done today</> : "Mark today"}
                        </Button>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(tally.rate)}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              (() => {
                const { keys: mKeys, label } = monthKeysOf(anchorEnd);
                const dayAgg = new Map<string, { completed: number; scheduled: number }>();
                for (const k of mKeys) dayAgg.set(k, { completed: 0, scheduled: 0 });
                for (const h of filteredHabits) {
                  const createdKey = toDateKey(new Date(h.createdAt));
                  const perDate = logMap.get(h.id) ?? new Map<string, HabitLog>();
                  for (const k of mKeys) {
                    const st = dayStatus(h, perDate.get(k), k, today, createdKey);
                    if (st === "none") continue;
                    const e = dayAgg.get(k)!;
                    e.scheduled++;
                    if (st === "completed") e.completed++;
                  }
                }
                const offset = startOffset(mKeys[0]);
                const cal: (string | null)[] = [...Array(offset).fill(null), ...mKeys];
                return (
                  <div className="p-4">
                    <p className="mb-3 text-sm font-semibold">{label}</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                      {weekHeadLabels.map((d) => <span key={d}>{d}</span>)}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {cal.map((k, i) => {
                        if (k == null) return <span key={`b${i}`} />;
                        const e = dayAgg.get(k)!;
                        const rate = e.scheduled > 0 ? e.completed / e.scheduled : 0;
                        const intensity = e.scheduled === 0 ? 0 : 0.18 + rate * 0.82;
                        const isT = k === today;
                        return (
                          <div
                            key={k}
                            title={`${fmtDay(k).day} ${fmtDay(k).month}: ${e.completed}/${e.scheduled}`}
                            className={cn("flex aspect-square flex-col items-center justify-center rounded-lg text-xs", e.scheduled === 0 && "bg-muted/40 text-muted-foreground", isT && "ring-2 ring-primary")}
                            style={e.scheduled > 0 ? { backgroundColor: `rgba(16,185,129,${intensity})`, color: rate > 0.5 ? "#fff" : undefined } : undefined}
                          >
                            <span className="tabular-nums">{fmtDay(k).day}</span>
                            {e.scheduled > 0 && <span className="text-[9px] opacity-80">{e.completed}/{e.scheduled}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
            {/* Quick-add right where the habits are */}
            <div className="flex items-center gap-2 border-t px-4 py-2.5">
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
                placeholder="Add a habit and press Enter…"
                className="h-9 flex-1"
              />
              <Button size="sm" onClick={quickAdd} disabled={!quickName.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={openCreate}>More options</Button>
            </div>
            {viewMode !== "calendar" && (
              <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <LegendDot cls="bg-emerald-500" label="Completed" />
                <LegendDot cls="bg-amber-500" label="Partial" />
                <LegendDot cls="bg-rose-500" label="Missed" />
                <LegendDot cls="border border-muted-foreground/30" label="Not done" />
                <span className="ml-auto">Tap a cell to toggle · right-click for a note</span>
              </div>
            )}
          </Card>

          {/* 365-day activity — GitHub-style, full width */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 365 days</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                Less
                <span className="h-3 w-3 rounded-sm bg-muted/40" />
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,0.4)" }} />
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,0.7)" }} />
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,1)" }} />
                More
              </span>
            </div>
            <div className="p-4">
              <YearHeatmap keys={yearKeys} heat={yearHeat} today={today} weekStart={weekStart} />
            </div>
          </Card>

          {/* Bottom widgets */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Weekly completion">
              <div className="flex h-32 items-end justify-between gap-1.5">
                {weekdayOrder.map((wd) => {
                  const a = weekday[wd];
                  const rate = a.scheduled > 0 ? (a.completed / a.scheduled) * 100 : 0;
                  return (
                    <div key={wd} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(3, rate)}%` }} title={`${Math.round(rate)}%`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{WEEK_HEADS[(wd + 6) % 7][0]}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Best streaks">
              {bestStreaks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No streaks yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {bestStreaks.map(({ habit: h, best }) => (
                    <li key={h.id} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${h.color ?? DEFAULT_HABIT_COLOR}22` }}>
                        {h.emoji || <Flame className="h-4 w-4" style={{ color: h.color ?? DEFAULT_HABIT_COLOR }} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-500"><Flame className="h-3.5 w-3.5" /> {best}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Summary">
              <ul className="space-y-2 text-sm">
                <SummaryRow cls="bg-emerald-500" label="Completed" value={allTally.completed} />
                <SummaryRow cls="bg-amber-500" label="Partial" value={allTally.partial} />
                <SummaryRow cls="bg-rose-500" label="Missed" value={allTally.missed} />
                <SummaryRow cls="border border-muted-foreground/30" label="Not done" value={allTally.none} />
              </ul>
            </Panel>
          </div>
        </>
      )}

      {user && (
        <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} userId={user.uid} habit={editing} onSaved={load} />
      )}

      <HabitStatsDialog
        open={statsHabit !== null}
        onOpenChange={(o) => { if (!o) setStatsHabit(null); }}
        habit={statsHabit}
        logs={statsHabit ? (logsByHabit[statsHabit.id] ?? []) : []}
      />

      {user && (
        <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} userId={user.uid} onSaved={load} />
      )}

      <IconColorDialog
        open={appearanceId !== null}
        onOpenChange={(o) => { if (!o) setAppearanceId(null); }}
        habit={appearanceId ? (habits.find((h) => h.id === appearanceId) ?? null) : null}
        onApply={applyAppearance}
      />

      {user && (
        <DayEditorDialog
          open={noteTarget !== null}
          onOpenChange={(o) => { if (!o) setNoteTarget(null); }}
          userId={user.uid}
          habit={noteTarget?.habit ?? null}
          date={noteTarget?.date ?? null}
          log={noteTarget ? (logsByHabit[noteTarget.habit.id]?.find((l) => l.completedDate === noteTarget.date) ?? null) : null}
          onSaved={() => load({ quiet: true })}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this habit?"
        description="This permanently deletes the habit and its entire check-in history."
        onConfirm={async () => {
          if (deleting) {
            await deleteHabit(deleting.userId, deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function StatusCell({ status, color, value, showNumber, disabled, hasNote, animate, title, onClick, onNote }: {
  status: DayStatus; color: string; value: number | null; showNumber: boolean; disabled: boolean; hasNote: boolean; animate?: boolean; title?: string; onClick: () => void; onNote: () => void;
}) {
  const base = cn(
    "relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition",
    animate && status === "completed" && "animate-checkin"
  );
  let cls = "";
  let style: React.CSSProperties | undefined;
  let content: React.ReactNode = null;
  let label = "Not done";
  if (status === "completed") {
    cls = "text-white";
    style = { backgroundColor: color };
    content = showNumber ? value : <Check className="h-5 w-5" />;
    label = "Completed";
  } else if (status === "partial") {
    style = { backgroundColor: `${color}40`, color };
    content = showNumber ? value : "◐";
    label = "Partial";
  } else if (status === "missed") {
    cls = "bg-rose-500/15 text-rose-500";
    content = "✕";
    label = "Missed";
  } else {
    cls = cn("border border-muted-foreground/25 text-transparent hover:border-muted-foreground/60", disabled && "opacity-30 hover:border-muted-foreground/25");
  }
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); if (!disabled) onNote(); }}
      disabled={disabled}
      className={cn(base, cls)}
      style={style}
      aria-label={label}
      title={title ?? label}
    >
      {content}
      {hasNote && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-400 ring-1 ring-card" />}
    </button>
  );
}

function YearHeatmap({ keys, heat, today, weekStart }: { keys: string[]; heat: Map<string, { completed: number; scheduled: number }>; today: string; weekStart: "mon" | "sun" }) {
  if (keys.length === 0) return null;
  // Pad the start so column 0 begins on the chosen week-start, then chunk into weeks.
  const firstDay = new Date(keys[0] + "T00:00:00").getDay();
  const offset = weekStart === "mon" ? (firstDay + 6) % 7 : firstDay;
  const cells: (string | null)[] = [...Array(offset).fill(null), ...keys];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const k = week[di] ?? null;
              if (k == null) return <span key={di} className="h-3 w-3" />;
              const e = heat.get(k) ?? { completed: 0, scheduled: 0 };
              const rate = e.scheduled > 0 ? e.completed / e.scheduled : 0;
              const intensity = e.scheduled === 0 ? 0 : 0.18 + rate * 0.82;
              const d = fmtDay(k);
              return (
                <div
                  key={di}
                  title={`${d.day} ${d.month}: ${e.completed}/${e.scheduled}`}
                  className={cn("h-3 w-3 rounded-sm", e.scheduled === 0 && "bg-muted/40", k === today && "ring-1 ring-primary")}
                  style={e.scheduled > 0 ? { backgroundColor: `rgba(16,185,129,${intensity})` } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
      {label}
    </span>
  );
}

function SummaryRow({ cls, label, value }: { cls: string; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>
    </li>
  );
}
