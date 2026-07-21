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
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getHabits,
  getHabitLogs,
  toggleHabitLog,
  deleteHabit,
} from "@/lib/firebase/db";
import {
  dayStatus,
  tallyStatuses,
  lastNDays,
  addDays,
  HABIT_CATEGORIES,
  HABIT_CATEGORY_LABEL,
  DEFAULT_HABIT_COLOR,
  type DayStatus,
} from "@/lib/habits";
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

export default function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByHabit, setLogsByHabit] = useState<Record<string, HabitLog[]>>({});
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const [anchorEnd, setAnchorEnd] = useState(toDateKey(new Date()));
  const [showNumbers, setShowNumbers] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"all" | HabitCategory>("all");
  const [search, setSearch] = useState("");

  const today = toDateKey(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [h, logs] = await Promise.all([getHabits(user.uid), getHabitLogs(user.uid)]);
      const byHabit: Record<string, HabitLog[]> = {};
      for (const log of logs) (byHabit[log.habitId] ??= []).push(log);
      setHabits(h);
      setLogsByHabit(byHabit);
    } finally {
      setLoading(false);
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

  const keys = useMemo(() => lastNDays(anchorEnd, WINDOW), [anchorEnd]);
  const prevKeys = useMemo(() => lastNDays(addDays(keys[0], -1), WINDOW), [keys]);

  const filteredHabits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return habits.filter((h) => {
      if (filterCategory !== "all" && h.category !== filterCategory) return false;
      if (!q) return true;
      return (
        h.title.toLowerCase().includes(q) ||
        (h.tags ?? []).some((t) => t.includes(q)) ||
        (h.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [habits, filterCategory, search]);

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
  const prevRate = useMemo(() => {
    const statuses: DayStatus[] = filteredHabits.flatMap((h) => {
      const createdKey = toDateKey(new Date(h.createdAt));
      const perDate = logMap.get(h.id) ?? new Map<string, HabitLog>();
      return prevKeys.map((k) => dayStatus(h, perDate.get(k), k, today, createdKey));
    });
    return tallyStatuses(statuses).rate;
  }, [filteredHabits, logMap, prevKeys, today]);

  const currentStreakMax = filteredHabits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0);
  const bestStreakMax = filteredHabits.reduce((m, h) => Math.max(m, h.bestStreak ?? 0), 0);
  const trend = allTally.rate - prevRate;

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

  const heat = useMemo(() => {
    const m = new Map<string, { completed: number; scheduled: number }>();
    for (const k of keys) m.set(k, { completed: 0, scheduled: 0 });
    for (const g of grid)
      for (const c of g.cells) {
        if (c.status === "none") continue;
        const e = m.get(c.key)!;
        e.scheduled++;
        if (c.status === "completed") e.completed++;
      }
    return m;
  }, [grid, keys]);

  const bestStreaks = useMemo(
    () => [...habits].filter((h) => (h.bestStreak ?? 0) > 0).sort((a, b) => b.bestStreak - a.bestStreak).slice(0, 5),
    [habits]
  );

  const doneToday = habits.filter((h) => (logMap.get(h.id)?.has(today) ?? false)).length;

  async function toggleCell(habit: Habit, key: string, status: DayStatus) {
    if (!user || key > today) return;
    const done = status !== "completed";
    const fullValue = (habit.targetType ?? "check") !== "check" ? habit.targetValue : null;
    setLogsByHabit((prev) => {
      const logs = (prev[habit.id] ?? []).filter((l) => l.completedDate !== key);
      if (done) logs.push({ id: `${habit.id}_${key}`, habitId: habit.id, userId: user.uid, completedDate: key, value: fullValue, createdAt: Date.now() });
      return { ...prev, [habit.id]: logs };
    });
    try {
      await toggleHabitLog(user.uid, habit.id, key, done, fullValue);
      setHabits(await getHabits(user.uid));
    } catch {
      await load();
    }
  }

  function shiftWindow(delta: number) {
    setAnchorEnd((cur) => {
      const next = addDays(cur, delta * WINDOW);
      return next > today ? today : next;
    });
  }
  const atToday = anchorEnd >= today;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">My Habits</h1>
          <p className="text-muted-foreground">
            {habits.length > 0 ? `${doneToday}/${habits.length} done today — small daily actions, big life changes.` : "Small daily actions, big life changes."}
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
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add habit
            </Button>
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
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <Stat icon={ListChecks} tint="bg-emerald-500/15 text-emerald-500" label="Total habits" value={String(filteredHabits.length)} sub="Active habits" />
            <Stat icon={Target} tint="bg-violet-500/15 text-violet-500" label="Completion rate" value={`${Math.round(allTally.rate)}%`} sub="This period" />
            <Stat icon={Flame} tint="bg-orange-500/15 text-orange-500" label="Current streak" value={`${currentStreakMax} ${currentStreakMax === 1 ? "day" : "days"}`} sub={`Best ${bestStreakMax} days`} />
            <Stat icon={Award} tint="bg-amber-500/15 text-amber-500" label="Total completions" value={allTally.completed.toLocaleString()} sub="This period" />
            <Stat
              icon={trend >= 0 ? TrendingUp : TrendingDown}
              tint={trend >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}
              label="Success trend"
              value={`${trend >= 0 ? "+" : ""}${Math.round(trend)}%`}
              sub="vs last 4 weeks"
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
            <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Show numbers
            </label>
          </div>

          {/* Grid */}
          <Card className="overflow-hidden">
            {grid.length === 0 ? (
              <CardContent className="p-10 text-center text-sm text-muted-foreground">No habits match this filter.</CardContent>
            ) : (
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
                        <tr key={habit.id} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${color}22` }}>
                                {habit.emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{habit.title}</p>
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
                                onClick={() => toggleCell(habit, c.key, c.status)}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                                <div className="h-full rounded-full" style={{ width: `${Math.round(tally.rate)}%`, backgroundColor: color }} />
                              </div>
                              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(tally.rate)}%</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Habit menu"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditing(habit); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDeleting(habit)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
              <LegendDot cls="bg-emerald-500" label="Completed" />
              <LegendDot cls="bg-amber-500" label="Partial" />
              <LegendDot cls="bg-rose-500" label="Missed" />
              <LegendDot cls="border border-muted-foreground/30" label="Not done" />
              <span className="ml-auto">Tap a cell to toggle completion</span>
            </div>
          </Card>

          {/* Bottom widgets */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
                  {bestStreaks.map((h) => (
                    <li key={h.id} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${h.color ?? DEFAULT_HABIT_COLOR}22` }}>
                        {h.emoji || <Flame className="h-4 w-4" style={{ color: h.color ?? DEFAULT_HABIT_COLOR }} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-500"><Flame className="h-3.5 w-3.5" /> {h.bestStreak}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Completion heatmap">
              <Heatmap keys={keys} heat={heat} today={today} />
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

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this habit?"
        description="This permanently deletes the habit and its entire check-in history."
        onConfirm={async () => {
          if (deleting) {
            await deleteHabit(deleting.id);
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

function StatusCell({ status, color, value, showNumber, disabled, onClick }: {
  status: DayStatus; color: string; value: number | null; showNumber: boolean; disabled: boolean; onClick: () => void;
}) {
  const base = "mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition";
  if (status === "completed") {
    return (
      <button onClick={onClick} disabled={disabled} className={cn(base, "text-white")} style={{ backgroundColor: color }} aria-label="Completed">
        {showNumber ? value : <Check className="h-3.5 w-3.5" />}
      </button>
    );
  }
  if (status === "partial") {
    return (
      <button onClick={onClick} disabled={disabled} className={cn(base)} style={{ backgroundColor: `${color}40`, color }} aria-label="Partial">
        {showNumber ? value : "◐"}
      </button>
    );
  }
  if (status === "missed") {
    return (
      <button onClick={onClick} disabled={disabled} className={cn(base, "bg-rose-500/15 text-rose-500")} aria-label="Missed">
        ✕
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, "border border-muted-foreground/25 text-transparent hover:border-muted-foreground/60", disabled && "opacity-30 hover:border-muted-foreground/25")} aria-label="Not done" />
  );
}

function Heatmap({ keys, heat, today }: { keys: string[]; heat: Map<string, { completed: number; scheduled: number }>; today: string }) {
  if (keys.length === 0) return null;
  const offset = (new Date(keys[0] + "T00:00:00").getDay() + 6) % 7; // Mon-first
  const cells: (string | null)[] = [...Array(offset).fill(null), ...keys];
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK_HEADS.map((d) => <span key={d} className="text-center text-[9px] text-muted-foreground">{d[0]}</span>)}
      {cells.map((k, i) => {
        if (k == null) return <span key={`b${i}`} />;
        const e = heat.get(k) ?? { completed: 0, scheduled: 0 };
        const rate = e.scheduled > 0 ? e.completed / e.scheduled : 0;
        const intensity = e.scheduled === 0 ? 0 : 0.2 + rate * 0.8;
        return (
          <div
            key={k}
            title={`${fmtDay(k).day} ${fmtDay(k).month}: ${e.completed}/${e.scheduled}`}
            className={cn("aspect-square rounded-sm", e.scheduled === 0 && "bg-muted/40", k === today && "ring-1 ring-primary")}
            style={e.scheduled > 0 ? { backgroundColor: `rgba(16,185,129,${intensity})` } : undefined}
          />
        );
      })}
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
