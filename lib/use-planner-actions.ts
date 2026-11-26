"use client";

import { useCallback } from "react";
import { useToast } from "@/components/toast/toast-provider";
import { setTaskDone, updateTask, updateTasksBatch } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addTimeEntry } from "@/lib/planner";
import {
  deadlineWarning,
  reschedulePatch,
  startTaskTimer,
  stopTaskTimer,
  stopTimerPatch,
} from "@/lib/planner-actions";
import type { Goal, Task } from "@/lib/types";

interface Options {
  /** Apply an optimistic change to the screen's task list. */
  mutate: (updater: (prev: Task[]) => Task[]) => void;
  /** Quiet re-fetch after a write, and the rollback path when one fails. */
  refresh: () => void;
  /** Look up a task's goal (for the after-deadline warning). */
  goalFor: (task: Task) => Pick<Goal, "deadline" | "title"> | null | undefined;
}

/**
 * The task mutations every planner screen shares — optimistic first, then
 * persisted, with a toast and a refresh if the write fails.
 */
export function usePlannerActions({ mutate, refresh, goalFor }: Options) {
  const { toast } = useToast();

  const patchLocal = useCallback(
    (id: string, patch: Partial<Task>) =>
      mutate((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [mutate]
  );

  const fail = useCallback(
    (message: string) => {
      toast({ message, tone: "error" });
      refresh();
    },
    [toast, refresh]
  );

  const toggleDone = useCallback(
    async (task: Task, done: boolean) => {
      // Finishing a task also stops its timer and banks the time.
      const timer = done && task.timerStartedAt != null ? stopTimerPatch(task) : null;
      patchLocal(task.id, {
        status: done ? "done" : "todo",
        completedAt: done ? Date.now() : null,
        ...(timer ?? {}),
      });
      try {
        if (timer) await updateTask(task.id, timer);
        await setTaskDone({ id: task.id, goalId: task.goalId }, done);
        refresh();
      } catch {
        fail("Couldn't update the task. Try again.");
      }
    },
    [patchLocal, refresh, fail]
  );

  const reschedule = useCallback(
    async (task: Task, date: string | null) => {
      if (date === task.dueDate) return;
      const patch = reschedulePatch(date);
      patchLocal(task.id, patch);
      try {
        await updateTask(task.id, patch);
        const warning = deadlineWarning(date, goalFor(task));
        if (warning) toast({ message: warning, duration: 6000 });
      } catch {
        fail("Couldn't move the task. Try again.");
      }
    },
    [patchLocal, goalFor, toast, fail]
  );

  /** Move several tasks at once; the toast offers an Undo. */
  const rescheduleMany = useCallback(
    async (moves: { task: Task; date: string | null }[], message: string) => {
      const real = moves.filter((m) => m.date !== m.task.dueDate);
      if (real.length === 0) return;
      const byId = new Map(real.map((m) => [m.task.id, reschedulePatch(m.date)]));
      mutate((prev) => prev.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
      try {
        await updateTasksBatch(real.map((m) => ({ id: m.task.id, patch: reschedulePatch(m.date) })));
        toast({
          message,
          tone: "success",
          duration: 7000,
          action: {
            label: "Undo",
            onClick: async () => {
              const undo = real.map((m) => ({
                id: m.task.id,
                patch: {
                  dueDate: m.task.dueDate,
                  startMin: m.task.startMin,
                  endMin: m.task.endMin,
                },
              }));
              const prevById = new Map(undo.map((u) => [u.id, u.patch]));
              mutate((prev) =>
                prev.map((t) => (prevById.has(t.id) ? { ...t, ...prevById.get(t.id) } : t))
              );
              try {
                await updateTasksBatch(undo);
              } catch {
                fail("Couldn't undo. Try again.");
              }
            },
          },
        });
      } catch {
        fail("Couldn't move the tasks. Try again.");
      }
    },
    [mutate, toast, fail]
  );

  const toggleTimer = useCallback(
    async (task: Task) => {
      try {
        if (task.timerStartedAt != null) {
          patchLocal(task.id, stopTimerPatch(task));
          await stopTaskTimer(task);
        } else {
          const now = Date.now();
          patchLocal(task.id, { timerStartedAt: now });
          await startTaskTimer(task, now);
        }
      } catch {
        fail("Couldn't update the timer. Try again.");
      }
    },
    [patchLocal, fail]
  );

  const addTime = useCallback(
    async (task: Task, minutes: number) => {
      const timeLog = addTimeEntry(task.timeLog, toDateKey(new Date()), minutes);
      patchLocal(task.id, { timeLog });
      try {
        await updateTask(task.id, { timeLog });
      } catch {
        fail("Couldn't log the time. Try again.");
      }
    },
    [patchLocal, fail]
  );

  return { toggleDone, reschedule, rescheduleMany, toggleTimer, addTime };
}
