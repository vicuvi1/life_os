"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Flame,
  Plus,
  Check,
  Target,
  TrendingUp,
  TrendingDown,
  ListChecks,
  Award,
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
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getHabits,
  getHabitLogs,
  toggleHabitLog,
  createHabit,
  updateHabit,
  deleteHabit,
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
  HABIT_CATEGORIES,
  HABIT_CATEGORY_LABEL,
  DEFAULT_HABIT_COLOR,
  DIFFICULTY_META,
  type DayStatus,
} from "@/lib/habits";
import { HabitStatsDialog } from "@/components/habits/habit-stats-dialog";
import { TemplatesDialog } from "@/components/habits/templates-dialog";
import { NoteDialog } from "@/components/habits/note-dialog";
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
import type { Habit, HabitCategory, HabitLog } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

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

  const [windowOffset, setWindowOffset] = useState(0); // 0 = current window (ends today)
  const [viewMode, setViewMode] = useState<"table" | "cards" | "compact" | "calendar">("table");
  const [showNumbers, setShowNumbers] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"all" | HabitCategory>("all");
  const [search, setSearch] = useState("");

  const today = toDateKey(new Date());

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
  const anchorEnd = useMemo(() => addDays(today, -windowOffset * WINDOW), [today, windowOffset]);
  const keys = useMemo(() => lastNDays(anchorEnd, WINDOW), [anchorEnd]);
  const prevKeys = useMemo(() => lastNDays(addDays(keys[0], -1), WINDOW), [keys]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const archivedCount = habits.length - activeHabits.length;

  const filteredHabits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return habits.filter((h) => {
      if (!showArchived && h.archived) return false;
      if (filterCategory !== "all" && h.category !== filterCategory) return false;
      if (!q) return true;
      return (
        h.title.toLowerCase().includes(q) ||
        (h.tags ?? []).some((t) => t.includes(q)) ||
        (h.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [habits, filterCategory, search, showArchived]);

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
  const prevTally = useMemo(() => {
    const statuses: DayStatus[] = filteredHabits.flatMap((h) => {
      const createdKey = toDateKey(new Date(h.createdAt));
      const perDate = logMap.get(h.id) ?? new Map<string, HabitLog>();
      return prevKeys.map((k) => dayStatus(h, perDate.get(k), k, today, createdKey));
    });
    return tallyStatuses(statuses);
  }, [filteredHabits, logMap, prevKeys, today]);
  const hasBaseline = prevTally.scheduled > 0;

  // Streaks computed live from logs (so toggling updates instantly, no refetch).
  const streaksByHabit = useMemo(() => {
    const m = new Map<string, { streak: number; best: number }>();
    for (const h of habits) {
      const done = doneDates(h, logsByHabit[h.id] ?? []);
      m.set(h.id, { streak: habitCurrentStreak(h, done, today), best: habitLongestStreak(h, done) });
    }
    return m;
  }, [habits, logsByHabit, today]);
  const currentStreakMax = filteredHabits.reduce((m, h) => Math.max(m, streaksByHabit.get(h.id)?.streak ?? 0), 0);
  const bestStreakMax = filteredHabits.reduce((m, h) => Math.max(m, streaksByHabit.get(h.id)?.best ?? 0), 0);
  const trend = allTally.rate - prevTally.rate;
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

  const doneToday = activeHabits.filter((h) => {
    const log = logMap.get(h.id)?.get(today);
    return log ? isLogDone(h, log) : false;
  }).length;

  async function setArchived(habit: Habit, archived: boolean) {
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, archived } : h)));
    try {
      await updateHabit(habit.id, { archived });
    } catch {
      await load();
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
        <DropdownMenuItem onClick={() => setNoteTarget({ habit, date: today })}><StickyNote className="h-4 w-4" /> Note for today</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setEditing(habit); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setArchived(habit, !habit.archived)}>
          {habit.archived ? <><ArchiveRestore className="h-4 w-4" /> Unarchive</> : <><Archive className="h-4 w-4" /> Archive</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDeleting(habit)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
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
            <Button variant="ghost" size="icon" aria-label="Next 4 weeks" onClick={() => shiftWindow(1)} disabled={atToday} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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

      {!loading && topStreak && topStreak.streak >= 3 && (
        <div className="flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm">
          <span className="text-lg">🔥</span>
          <span>
            <span className="font-semibold text-orange-500">{topStreak.streak}-day streak</span> on{" "}
            {topStreak.habit.emoji ? `${topStreak.habit.emoji} ` : ""}
            {topStreak.habit.title} — don&apos;t break it!
          </span>
        </div>
      )}

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
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <Stat icon={ListChecks} tint="bg-emerald-500/15 text-emerald-500" label="Total habits" value={String(filteredHabits.length)} sub="Active habits" />
            <Stat icon={Target} tint="bg-violet-500/15 text-violet-500" label="Completion rate" value={`${Math.round(allTally.rate)}%`} sub="This period" />
            <Stat icon={Flame} tint="bg-orange-500/15 text-orange-500" label="Current streak" value={`${currentStreakMax} ${currentStreakMax === 1 ? "day" : "days"}`} sub={`Best ${bestStreakMax} days`} />
            <Stat icon={Award} tint="bg-amber-500/15 text-amber-500" label="Total completions" value={allTally.completed.toLocaleString()} sub="This period" />
            <Stat
              icon={!hasBaseline ? TrendingUp : trend >= 0 ? TrendingUp : TrendingDown}
              tint={!hasBaseline ? "bg-muted text-muted-foreground" : trend >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}
              label="Success trend"
              value={hasBaseline ? `${trend >= 0 ? "+" : ""}${Math.round(trend)}%` : "New"}
              sub={hasBaseline ? "vs last 4 weeks" : "no prior data yet"}
            />
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2">
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as "all" | HabitCategory)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All habits</SelectItem>
                {HABIT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{HABIT_CATEGORY_LABEL[c]}</SelectItem>)}
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left align-bottom">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Habit</span>
                      </th>
                      {keys.map((k) => {
                        const { wd, day } = fmtDay(k);
                        const isToday = k === today;
                        return (
                          <th key={k} className={cn("w-[34px] px-0 py-1 text-center align-bottom", isToday && "text-primary")}>
                            <div className="text-[9px] uppercase text-muted-foreground">{wd[0]}</div>
                            <div className={cn("text-[11px] tabular-nums", isToday ? "font-bold text-primary" : "text-muted-foreground")}>{day}</div>
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
                      return (
                        <tr key={habit.id} className={cn("group border-b last:border-0 hover:bg-accent/30", habit.archived && "opacity-50")}>
                          <td className="sticky left-0 z-10 bg-card px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${color}22` }}>
                                {habit.emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DIFFICULTY_META[habit.difficulty].color }} title={`${DIFFICULTY_META[habit.difficulty].label} difficulty`} />
                                  {habit.title}
                                </p>
                                {(habit.tags ?? []).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {habit.tags.slice(0, 3).map((t) => (
                                      <span key={t} className="rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {cells.map((c) => (
                            <td key={c.key} className="p-0.5 text-center">
                              <StatusCell
                                status={c.status}
                                color={color}
                                value={c.log?.value ?? null}
                                showNumber={showNumbers && (habit.targetType ?? "check") !== "check"}
                                disabled={c.key > today}
                                hasNote={Boolean(c.log?.note)}
                                onClick={() => toggleCell(habit, c.key, c.status)}
                                onNote={() => setNoteTarget({ habit, date: c.key })}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                                <div className="h-full rounded-full" style={{ width: `${Math.round(tally.rate)}%`, backgroundColor: color }} />
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
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${color}22` }}>
                        {habit.emoji || <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DIFFICULTY_META[habit.difficulty].color }} />
                          {habit.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{Math.round(tally.rate)}%{(habit.tags ?? []).length > 0 ? ` · ${habit.tags.slice(0, 2).join(", ")}` : ""}</p>
                      </div>
                      <div className="hidden items-center gap-0.5 md:flex">
                        {recent.map((c) => (
                          <StatusCell key={c.key} status={c.status} color={color} value={c.log?.value ?? null} showNumber={false} disabled={c.key > today} hasNote={Boolean(c.log?.note)} onClick={() => toggleCell(habit, c.key, c.status)} onNote={() => setNoteTarget({ habit, date: c.key })} />
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
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${color}22` }}>
                            {habit.emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                          </span>
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
                const offset = (new Date(mKeys[0] + "T00:00:00").getDay() + 6) % 7;
                const cal: (string | null)[] = [...Array(offset).fill(null), ...mKeys];
                return (
                  <div className="p-4">
                    <p className="mb-3 text-sm font-semibold">{label}</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                      {WEEK_HEADS.map((d) => <span key={d}>{d}</span>)}
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
              <YearHeatmap keys={yearKeys} heat={yearHeat} today={today} />
            </div>
          </Card>

          {/* Bottom widgets */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Weekly completion">
              <div className="flex h-32 items-end justify-between gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
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

      {user && (
        <NoteDialog
          open={noteTarget !== null}
          onOpenChange={(o) => { if (!o) setNoteTarget(null); }}
          userId={user.uid}
          habit={noteTarget?.habit ?? null}
          date={noteTarget?.date ?? null}
          currentNote={noteTarget ? (logsByHabit[noteTarget.habit.id]?.find((l) => l.completedDate === noteTarget.date)?.note ?? null) : null}
          onSaved={load}
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
function Stat({ icon: Icon, tint, label, value, sub }: { icon: LucideIcon; tint: string; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tint)}><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

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

function StatusCell({ status, color, value, showNumber, disabled, hasNote, onClick, onNote }: {
  status: DayStatus; color: string; value: number | null; showNumber: boolean; disabled: boolean; hasNote: boolean; onClick: () => void; onNote: () => void;
}) {
  const base = "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition";
  let cls = "";
  let style: React.CSSProperties | undefined;
  let content: React.ReactNode = null;
  let label = "Not done";
  if (status === "completed") {
    cls = "text-white";
    style = { backgroundColor: color };
    content = showNumber ? value : <Check className="h-3.5 w-3.5" />;
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
      title={hasNote ? "Has a note · right-click to edit" : "Right-click to add a note"}
    >
      {content}
      {hasNote && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sky-400 ring-1 ring-card" />}
    </button>
  );
}

function YearHeatmap({ keys, heat, today }: { keys: string[]; heat: Map<string, { completed: number; scheduled: number }>; today: string }) {
  if (keys.length === 0) return null;
  // Pad the start so column 0 begins on a Monday, then chunk into week-columns.
  const offset = (new Date(keys[0] + "T00:00:00").getDay() + 6) % 7;
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
