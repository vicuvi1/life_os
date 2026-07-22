"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CornerDownLeft,
  Target,
  CheckSquare,
  Flame,
  CalendarClock,
  Plus,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NAV } from "@/lib/nav";
import { getGoals, getTasks, getHabits, getSessions, createTask, createGoal } from "@/lib/firebase/db";
import { invalidateCache } from "@/lib/use-cached-resource";
import { useToast } from "@/components/toast/toast-provider";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { HabitFormDialog } from "@/components/habits/habit-form-dialog";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Goal, Habit, Session, Task } from "@/lib/types";

type CreateType = "task" | "goal" | "habit";

interface CommandCtx {
  openPalette: () => void;
  openCreate: (type: CreateType) => void;
}

const Ctx = createContext<CommandCtx | null>(null);

export function useCommand(): CommandCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}

interface Cmd {
  id: string;
  group: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  run: () => void;
}

const GROUP_ORDER = ["Capture", "Create", "Goals", "Tasks", "Habits", "Sessions", "Go to"];

export function CommandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  const openCreate = useCallback((type: CreateType) => {
    setOpen(false);
    setCreateType(type);
  }, []);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setActive(0);
          }
          return !o;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load searchable data when the palette opens (served from the local cache).
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    Promise.all([
      getGoals(user.uid),
      getTasks(user.uid),
      getHabits(user.uid),
      getSessions(user.uid),
    ]).then(([g, t, h, s]) => {
      if (!cancelled) {
        setGoals(g);
        setTasks(t);
        setHabits(h);
        setSessions(s);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // --- Natural-language quick capture ---------------------------------------
  const createQuickTask = useCallback(
    async (title: string) => {
      if (!user || !title.trim()) return;
      await createTask(user.uid, {
        title: title.trim(),
        description: null,
        priority: "medium",
        dueDate: null,
        projectId: null,
        goalId: null,
      });
      invalidateCache();
      toast({ message: "Task created", tone: "success" });
    },
    [user, toast]
  );

  const createMoneyGoal = useCallback(
    async (title: string, amount: number) => {
      if (!user) return;
      await createGoal(user.uid, {
        title: title.trim(),
        description: null,
        status: "active",
        priority: "medium",
        measurement: "count",
        startDate: null,
        deadline: null,
        quarter: null,
        category: "Finance",
        targetValue: amount,
        currentValue: 0,
        unit: "$",
        composite: [],
        milestones: [],
        icon: "💰",
        color: "#10b981",
        staleDays: null,
        dependsOn: [],
      });
      invalidateCache();
      toast({ message: "Goal created", tone: "success" });
    },
    [user, toast]
  );

  const commands = useMemo<Cmd[]>(() => {
    const create: Cmd[] = [
      { id: "c-task", group: "Create", label: "New task", icon: CheckSquare, hint: "N", run: () => openCreate("task") },
      { id: "c-goal", group: "Create", label: "New goal", icon: Target, hint: "G", run: () => openCreate("goal") },
      { id: "c-habit", group: "Create", label: "New habit", icon: Flame, run: () => openCreate("habit") },
    ];
    const nav: Cmd[] = NAV.map((n) => ({
      id: `nav-${n.href}`,
      group: "Go to",
      label: n.label,
      icon: n.icon,
      run: () => router.push(n.href),
    }));

    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) return [...create, ...nav];

    // Natural-language capture — the typed text becomes something you can make.
    const capture: Cmd[] = [
      {
        id: "cap-task",
        group: "Capture",
        label: `Create task “${raw}”`,
        icon: Plus,
        run: () => void createQuickTask(raw),
      },
    ];
    const moneyMatch = raw.match(/(\d[\d,]*)/);
    const amount = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, ""), 10) : 0;
    if (amount > 0 && /(\$|\bsave\b)/i.test(raw)) {
      capture.push({
        id: "cap-money",
        group: "Capture",
        label: `Create goal: Save $${amount.toLocaleString()}`,
        icon: Wallet,
        run: () => void createMoneyGoal(raw, amount),
      });
    }

    const match = (c: Cmd) => c.label.toLowerCase().includes(q);
    const goalCmds = goals
      .map<Cmd>((g) => ({ id: `g-${g.id}`, group: "Goals", label: g.title, icon: Target, run: () => router.push(`/goals/${g.id}`) }))
      .filter(match)
      .slice(0, 8);
    const taskCmds = tasks
      .map<Cmd>((t) => ({ id: `t-${t.id}`, group: "Tasks", label: t.title, icon: CheckSquare, run: () => router.push("/tasks") }))
      .filter(match)
      .slice(0, 8);
    const habitCmds = habits
      .map<Cmd>((h) => ({ id: `h-${h.id}`, group: "Habits", label: h.title, icon: Flame, run: () => router.push("/habits") }))
      .filter(match)
      .slice(0, 6);
    const sessionCmds = sessions
      .map<Cmd>((s) => ({ id: `s-${s.id}`, group: "Sessions", label: s.title, icon: CalendarClock, run: () => router.push("/sessions") }))
      .filter(match)
      .slice(0, 6);

    return [
      ...capture,
      ...create.filter(match),
      ...goalCmds,
      ...taskCmds,
      ...habitCmds,
      ...sessionCmds,
      ...nav.filter(match),
    ];
  }, [query, goals, tasks, habits, sessions, router, openCreate, createQuickTask, createMoneyGoal]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  const grouped = useMemo(() => {
    const map = new Map<string, { cmd: Cmd; index: number }[]>();
    commands.forEach((cmd, index) => {
      const arr = map.get(cmd.group) ?? [];
      arr.push({ cmd, index });
      map.set(cmd.group, arr);
    });
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [commands]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[active]?.run();
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const ctxValue = useMemo(() => ({ openPalette, openCreate }), [openPalette, openCreate]);
  const onCreated = useCallback(
    (label: string) => {
      invalidateCache();
      toast({ message: `${label} created`, tone: "success" });
    },
    [toast]
  );

  return (
    <Ctx.Provider value={ctxValue}>
      {children}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[14vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Type a command or search…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                esc
              </kbd>
            </div>
            <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
              {commands.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                grouped.map((g) => (
                  <div key={g.group} className="mb-1">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {g.group}
                    </p>
                    {g.items.map(({ cmd, index }) => {
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onMouseMove={() => setActive(index)}
                          onClick={() => {
                            cmd.run();
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                            active === index ? "bg-accent text-foreground" : "text-foreground/80"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                          {cmd.hint && (
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {cmd.hint}
                            </kbd>
                          )}
                          {active === index && (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {user && (
        <>
          <TaskFormDialog
            open={createType === "task"}
            onOpenChange={(o) => !o && setCreateType(null)}
            userId={user.uid}
            goalId={null}
            projectId={null}
            onSaved={() => onCreated("Task")}
          />
          <GoalFormDialog
            open={createType === "goal"}
            onOpenChange={(o) => !o && setCreateType(null)}
            userId={user.uid}
            onSaved={() => onCreated("Goal")}
          />
          <HabitFormDialog
            open={createType === "habit"}
            onOpenChange={(o) => !o && setCreateType(null)}
            userId={user.uid}
            onSaved={() => onCreated("Habit")}
          />
        </>
      )}
    </Ctx.Provider>
  );
}
