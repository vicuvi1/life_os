"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Loader2, ListTodo } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getTasks, getGoals, createTask, deleteTask } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import type { Goal, Task } from "@/lib/types";

type Filter = "today" | "open" | "all";

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");

  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<Task | null>(null);
  // Optimistically hidden while the undo window is open; actually deleted once
  // the timer fires (see handleDelete).
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, g] = await Promise.all([getTasks(user.uid), getGoals(user.uid)]);
      setTasks(t);
      setGoals(g);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Deliberately no unmount cleanup here: a pending delete's timer should
  // keep running (and actually commit) even if the user navigates away
  // within the undo window, the same way "undo send" works elsewhere —
  // navigating away isn't a cancel, only clicking Undo is.

  const goalTitle = useMemo(() => {
    const m = new Map(goals.map((g) => [g.id, g.title]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [goals]);

  const today = toDateKey(new Date());

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => !pendingDeleteIds.has(t.id))
      .filter((t) => {
        if (filter === "all") return true;
        if (filter === "open") return t.status !== "done";
        // today: due today or overdue, and not done
        return t.status !== "done" && t.dueDate !== null && t.dueDate <= today;
      });
  }, [tasks, filter, today, pendingDeleteIds]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !quickTitle.trim()) return;
    setAdding(true);
    try {
      await createTask(user.uid, {
        title: quickTitle.trim(),
        description: null,
        priority: "medium",
        dueDate: filter === "today" ? today : null,
        goalId: null,
        projectId: null,
      });
      setQuickTitle("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  // Reversible delete: hide immediately, show an Undo toast, and only commit
  // the actual deletion after the toast window elapses.
  function handleDelete(task: Task) {
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

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "open", label: "Open" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Tasks</h1>
        <p className="text-muted-foreground">
          Your daily execution list. Check things off to move goals forward.
        </p>
      </div>

      {/* Quick add */}
      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a quick task and press Enter…"
        />
        <Button type="submit" disabled={adding || !quickTitle.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {/* Filters */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <ListTodo className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">
              {filter === "today"
                ? "Nothing due today"
                : filter === "open"
                  ? "No open tasks"
                  : "No tasks yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a quick task above, or create tasks inside a goal&apos;s
              projects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className={cn("divide-y p-0")}>
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onChanged={load}
                onEdit={setEditing}
                onDelete={handleDelete}
                context={goalTitle(t.goalId)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      {user && (
        <TaskFormDialog
          open={Boolean(editing)}
          onOpenChange={(o) => !o && setEditing(null)}
          userId={user.uid}
          goalId={editing?.goalId ?? null}
          projectId={editing?.projectId ?? null}
          task={editing}
          onSaved={load}
        />
      )}
    </div>
  );
}
