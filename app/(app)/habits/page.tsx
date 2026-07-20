"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getHabits,
  getHabitLogs,
  toggleHabitLog,
  deleteHabit,
} from "@/lib/firebase/db";
import { habitStateFromDates, type HabitState } from "@/lib/habits";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HabitRow } from "@/components/habits/habit-row";
import { HabitFormDialog } from "@/components/habits/habit-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Habit } from "@/lib/types";

export default function HabitsPage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logDatesByHabit, setLogDatesByHabit] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const today = toDateKey(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [h, logs] = await Promise.all([
        getHabits(user.uid),
        getHabitLogs(user.uid),
      ]);
      const byHabit: Record<string, string[]> = {};
      for (const log of logs) {
        (byHabit[log.habitId] ??= []).push(log.completedDate);
      }
      setHabits(h);
      setLogDatesByHabit(byHabit);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const states = useMemo(() => {
    const map = new Map<string, HabitState>();
    for (const h of habits) {
      map.set(h.id, habitStateFromDates(logDatesByHabit[h.id] ?? [], today));
    }
    return map;
  }, [habits, logDatesByHabit, today]);

  const doneToday = habits.filter(
    (h) => states.get(h.id)?.completedToday
  ).length;

  async function handleToggle(habit: Habit, done: boolean) {
    if (!user) return;
    // Optimistic local update so the checkbox feels instant.
    setLogDatesByHabit((prev) => {
      const dates = new Set(prev[habit.id] ?? []);
      if (done) dates.add(today);
      else dates.delete(today);
      return { ...prev, [habit.id]: Array.from(dates) };
    });
    await toggleHabitLog(user.uid, habit.id, today, done);
    // Refresh streak fields stored on the habit doc.
    setHabits(await getHabits(user.uid));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Habits</h1>
          <p className="text-muted-foreground">
            {habits.length > 0
              ? `${doneToday}/${habits.length} done today — keep the streak alive.`
              : "Daily habits with streaks. Build momentum one day at a time."}
          </p>
        </div>
        {user && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New habit
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : habits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Flame className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No habits yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add habits like vitamins, Spanish, or workout and check them off
              each day to build streaks.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add a habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {habits.map((habit) => {
              const state =
                states.get(habit.id) ?? habitStateFromDates([], today);
              return (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  state={state}
                  onToggle={(done) => handleToggle(habit, done)}
                  onEdit={(h) => {
                    setEditing(h);
                    setFormOpen(true);
                  }}
                  onDelete={setDeleting}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {user && (
        <HabitFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          userId={user.uid}
          habit={editing}
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
            await deleteHabit(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
