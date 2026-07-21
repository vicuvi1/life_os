"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  doneDates,
  habitCurrentStreak,
  habitLongestStreak,
  addDays,
  dayStatus,
  tallyStatuses,
  difficultyPoints,
  DIFFICULTY_META,
  DEFAULT_HABIT_COLOR,
} from "@/lib/habits";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/lib/types";

const WEEK_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  logs: HabitLog[];
}

export function HabitStatsDialog({ open, onOpenChange, habit, logs }: Props) {
  const stats = useMemo(() => {
    if (!habit) return null;
    const today = toDateKey(new Date());
    const done = doneDates(habit, logs);
    const set = new Set(done);
    const perDate = new Map(logs.map((l) => [l.completedDate, l] as const));

    // Range: created → today, capped to the last 365 days.
    const createdKey = toDateKey(new Date(habit.createdAt));
    const yearAgo = addDays(today, -364);
    let start = createdKey > yearAgo ? createdKey : yearAgo;
    if (start > today) start = today;
    const keys: string[] = [];
    for (let k = start; k <= today; k = addDays(k, 1)) keys.push(k);

    const statuses = keys.map((k) => dayStatus(habit, perDate.get(k), k, today, createdKey));
    const tally = tallyStatuses(statuses);

    // Average run length across the whole history.
    const sortedDone = [...set].sort();
    let runs = 0;
    for (const d of sortedDone) if (!set.has(addDays(d, -1))) runs++;
    const avgStreak = runs > 0 ? done.length / runs : 0;

    // By weekday (Mon-first) and by month (last 12).
    const byWeekday = Array.from({ length: 7 }, () => 0);
    for (const d of done) {
      const wd = (new Date(d + "T00:00:00").getDay() + 6) % 7;
      byWeekday[wd]++;
    }
    const byMonth = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      byMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const d of done) {
      const mk = d.slice(0, 7);
      if (byMonth.has(mk)) byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
    }

    return {
      current: habitCurrentStreak(habit, done, today),
      longest: habitLongestStreak(habit, done),
      avgStreak,
      successPct: tally.rate,
      missedPct: tally.scheduled > 0 ? (tally.missed / tally.scheduled) * 100 : 0,
      totalCompletions: done.length,
      points: difficultyPoints(habit.difficulty, done.length),
      byWeekday,
      byMonth: Array.from(byMonth.entries()),
    };
  }, [habit, logs]);

  const notes = useMemo(
    () => logs.filter((l) => l.note).sort((a, b) => (a.completedDate < b.completedDate ? 1 : -1)).slice(0, 6),
    [logs]
  );

  const color = habit?.color ?? DEFAULT_HABIT_COLOR;
  const maxWd = stats ? Math.max(1, ...stats.byWeekday) : 1;
  const maxMonth = stats ? Math.max(1, ...stats.byMonth.map(([, v]) => v)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{habit?.emoji || "📊"}</span>
            {habit?.title ?? "Habit"} — statistics
          </DialogTitle>
        </DialogHeader>

        {stats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Current streak" value={`${stats.current}d`} />
              <Metric label="Longest streak" value={`${stats.longest}d`} />
              <Metric label="Average streak" value={`${stats.avgStreak.toFixed(1)}d`} />
              <Metric label="Success" value={`${Math.round(stats.successPct)}%`} tone="good" />
              <Metric label="Missed" value={`${Math.round(stats.missedPct)}%`} tone="bad" />
              <Metric label="Completions" value={stats.totalCompletions.toLocaleString()} />
            </div>

            {habit && (
              <div className="flex items-center justify-between rounded-lg border bg-background/60 p-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DIFFICULTY_META[habit.difficulty].color }} />
                  {DIFFICULTY_META[habit.difficulty].label} difficulty
                </span>
                <span className="font-semibold tabular-nums">{stats.points.toLocaleString()} pts</span>
              </div>
            )}

            {notes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent notes</p>
                <ul className="space-y-1.5">
                  {notes.map((n) => (
                    <li key={n.id} className="flex gap-2 text-sm">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{n.completedDate.slice(5)}</span>
                      <span className="min-w-0 flex-1">{n.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By weekday</p>
              <div className="flex h-24 items-end gap-1.5">
                {stats.byWeekday.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t" style={{ height: `${Math.max(3, (v / maxWd) * 100)}%`, backgroundColor: color }} title={`${v}`} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{WEEK_HEADS[i][0]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By month (last 12)</p>
              <div className="flex h-24 items-end gap-1">
                {stats.byMonth.map(([mk, v]) => (
                  <div key={mk} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(3, (v / maxMonth) * 100)}%` }} title={`${mk}: ${v}`} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{MONTHS_SHORT[Number(mk.slice(5, 7)) - 1][0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "good" && "text-emerald-500", tone === "bad" && "text-rose-500")}>{value}</p>
    </div>
  );
}
