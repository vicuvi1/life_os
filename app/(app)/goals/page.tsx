"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Star,
  Sparkles,
  Flag,
  CircleDashed,
  Circle,
  CheckCircle2,
  CornerDownRight,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoals,
  getTasks,
  deleteGoal,
  setGoalCurrentValue,
  setGoalManualProgress,
  setGoalFocus,
  setTaskDone,
  updateGoalMilestones,
} from "@/lib/firebase/db";
import { goalProgressDetail, goalStale, goalNextAction, type NextAction } from "@/lib/goals";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { NumberField } from "@/components/ui/number-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { GoalBadges } from "@/components/goals/goal-badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal, Task } from "@/lib/types";

const actionKindLabel: Record<NextAction["kind"], string> = {
  task: "task",
  step: "step",
  milestone: "milestone",
};

export default function GoalsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [g, t] = await Promise.all([getGoals(user.uid), getTasks(user.uid)]);
      setGoals(g);
      setTasks(t);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const focusGoals = useMemo(() => goals.filter((g) => g.focus), [goals]);
  const otherGoals = useMemo(() => goals.filter((g) => !g.focus), [goals]);
  const activeCount = useMemo(
    () => goals.filter((g) => g.status === "active").length,
    [goals]
  );

  // Next action per goal — memoised so the Today strip and cards agree.
  const nextActions = useMemo(() => {
    const map = new Map<string, NextAction | null>();
    for (const g of goals) map.set(g.id, goalNextAction(g, tasks));
    return map;
  }, [goals, tasks]);

  const todayActions = useMemo(
    () =>
      focusGoals
        .map((g) => ({ goal: g, action: nextActions.get(g.id) ?? null }))
        .filter((x): x is { goal: Goal; action: NextAction } => Boolean(x.action)),
    [focusGoals, nextActions]
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(goal: Goal) {
    setEditing(goal);
    setFormOpen(true);
  }

  async function quickPercent(goal: Goal, v: number) {
    await setGoalManualProgress(goal.id, v);
    await load();
  }
  async function quickCount(goal: Goal, v: number) {
    await setGoalCurrentValue({ id: goal.id }, v);
    await load();
  }

  // Star / unstar — optimistic so the card jumps sections instantly.
  function toggleFocus(goal: Goal) {
    const next = !goal.focus;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, focus: next } : g)));
    void setGoalFocus(goal.id, next);
  }

  // Complete a goal's next action from the momentum strip.
  async function completeAction(goal: Goal, action: NextAction) {
    setCompleting(actionKey(goal.id, action));
    try {
      if (action.kind === "task") {
        await setTaskDone({ id: action.taskId, goalId: goal.id }, true);
      } else if (action.kind === "step") {
        await updateGoalMilestones(
          goal.id,
          goal.milestones.map((m) =>
            m.id === action.milestoneId
              ? { ...m, steps: m.steps.map((s) => (s.id === action.stepId ? { ...s, done: true } : s)) }
              : m
          )
        );
      } else {
        await updateGoalMilestones(
          goal.id,
          goal.milestones.map((m) =>
            m.id === action.milestoneId ? { ...m, done: true, completedDate: today } : m
          )
        );
      }
      await load();
    } finally {
      setCompleting(null);
    }
  }

  function actionKey(goalId: string, a: NextAction): string {
    if (a.kind === "task") return `${goalId}:t:${a.taskId}`;
    if (a.kind === "step") return `${goalId}:s:${a.stepId}`;
    return `${goalId}:m:${a.milestoneId}`;
  }

  // A single goal card, prominent (focus) or compact (everything else).
  function GoalCard({ goal, prominent }: { goal: Goal; prominent: boolean }) {
    const action = nextActions.get(goal.id) ?? null;
    return (
      <Card
        className={cn(
          "flex flex-col overflow-hidden",
          prominent && "ring-1 ring-primary/20"
        )}
        style={goal.color ? { borderLeft: `3px solid ${goal.color}` } : undefined}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => toggleFocus(goal)}
                aria-label={goal.focus ? "Remove from focus" : "Add to focus"}
                aria-pressed={goal.focus}
                className={cn(
                  "shrink-0 transition-colors",
                  goal.focus
                    ? "text-amber-400 hover:text-amber-500"
                    : "text-muted-foreground/40 hover:text-amber-400"
                )}
              >
                <Star className={cn("h-4 w-4", goal.focus && "fill-current")} />
              </button>
              <Link
                href={`/goals/${goal.id}`}
                className="flex min-w-0 items-center gap-2 font-semibold hover:underline"
              >
                {goal.icon && <span aria-hidden>{goal.icon}</span>}
                <span className="truncate">{goal.title}</span>
              </Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-1 h-8 w-8 shrink-0"
                  aria-label="Goal actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleFocus(goal)}>
                  <Star className={cn("h-4 w-4", goal.focus && "fill-current text-amber-400")} />
                  {goal.focus ? "Unfocus" : "Focus"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(goal)}>
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleting(goal)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <GoalBadges goal={goal} />
            {goalStale(goal, today) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Needs attention
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="mt-auto space-y-3">
          {prominent && goal.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{goal.description}</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{goalProgressDetail(goal) ?? "Progress"}</span>
              <span className="font-medium text-foreground">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} />
          </div>

          {/* Next action — context only; completion lives in Today's Momentum */}
          {action ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                <span className="text-muted-foreground/70">Next:</span>{" "}
                <span className="text-foreground/80">{action.title}</span>
              </span>
            </p>
          ) : prominent ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <CircleDashed className="h-3.5 w-3.5 shrink-0" />
              Add a task or milestone to see a next step.
            </p>
          ) : null}

          {/* One/two-click quick update, by measurement type */}
          {goal.measurement === "percentage" ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">Update</span>
              <NumberField
                value={goal.progress}
                onCommit={(v) => quickPercent(goal, v)}
                min={0}
                max={100}
                decimals={false}
                suffix="%"
                inputClassName="w-16"
                aria-label="Update progress percent"
              />
            </div>
          ) : goal.measurement === "count" ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">Update</span>
              <NumberField
                value={goal.currentValue}
                onCommit={(v) => quickCount(goal, v)}
                min={0}
                inputClassName="w-16"
                aria-label="Update current value"
              />
              <span className="text-muted-foreground">
                / {goal.targetValue ?? 0}
                {goal.unit ? ` ${goal.unit}` : ""}
              </span>
            </div>
          ) : null}

          <Button asChild variant="ghost" size="sm" className="w-full justify-between">
            <Link href={`/goals/${goal.id}`}>
              Open goal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const showFocusPrompt = !loading && focusGoals.length === 0 && goals.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Goals</h1>
          <p className="text-muted-foreground">
            Focus on what matters, then do the next thing.
            {activeCount > 0 && ` · ${activeCount} active`}
          </p>
        </div>
        {user && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New goal
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Target className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No goals yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first goal, then break it into projects and daily tasks.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add a goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Focus prompt / WIP nudge */}
          {showFocusPrompt && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
              <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="text-sm">
                <p className="font-medium">
                  {activeCount > 5
                    ? `You have ${activeCount} active goals.`
                    : "Pick your focus."}
                </p>
                <p className="text-muted-foreground">
                  Focus compounds — star your top 1–3 goals (the ☆ on each card).
                  They rise to the top and feed a daily momentum list.
                </p>
              </div>
            </div>
          )}

          {/* Today's Momentum — the daily driver */}
          {todayActions.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Today&apos;s Momentum</h2>
                <span className="text-xs text-muted-foreground">
                  · the next step on each focus goal
                </span>
              </div>
              <Card className="border-primary/25 bg-primary/[0.04]">
                <CardContent className="divide-y p-0">
                  {todayActions.map(({ goal, action }) => {
                    const key = actionKey(goal.id, action);
                    const busy = completing === key;
                    return (
                      <div key={key} className="flex items-center gap-3 px-4 py-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => completeAction(goal, action)}
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
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {actionKindLabel[action.kind]}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Focus goals */}
          {focusGoals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-current text-amber-400" />
                <h2 className="text-sm font-semibold">Focus</h2>
                <span className="text-xs text-muted-foreground">· {focusGoals.length}</span>
                {focusGoals.length > 3 && (
                  <span className="text-xs text-muted-foreground/70">
                    — focus works best with 3 or fewer
                  </span>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {focusGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} prominent />
                ))}
              </div>
            </section>
          )}

          {/* Everything else */}
          {otherGoals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  {focusGoals.length > 0 ? "More goals" : "Your goals"}
                </h2>
                <span className="text-xs text-muted-foreground">· {otherGoals.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {otherGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} prominent={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {user && (
        <GoalFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          userId={user.uid}
          goal={editing}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this goal?"
        description="This permanently deletes the goal and all its projects and tasks."
        onConfirm={async () => {
          if (deleting) {
            await deleteGoal(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
