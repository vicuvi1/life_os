"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  AlertTriangle,
  Star,
  Sparkles,
  Flag,
  Circle,
  CheckCircle2,
  Activity,
  Trophy,
  TrendingUp,
  Lock,
  LayoutGrid,
  Rows3,
  Table as TableIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoals,
  getTasks,
  deleteGoal,
  setGoalCurrentValue,
  setGoalManualProgress,
  setGoalFocus,
  updateGoalSubtasks,
} from "@/lib/firebase/db";
import { completeGoalNextAction } from "@/lib/goal-actions";
import {
  goalStale,
  goalNextAction,
  goalMomentum,
  goalPace,
  goalBlockers,
  categoryLabel,
  shortDate,
  type NextAction,
} from "@/lib/goals";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalsTable } from "@/components/goals/goals-table";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal, GoalSubtask, Task } from "@/lib/types";

const actionKindLabel: Record<NextAction["kind"], string> = {
  subtask: "subtask",
  task: "task",
  step: "step",
  milestone: "milestone",
};

// Session cache so re-opening Goals renders the last snapshot instantly instead
// of a skeleton, then revalidates in the background.
let goalsCache: { goals: Goal[]; tasks: Task[] } | null = null;

export default function GoalsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [goals, setGoals] = useState<Goal[]>(goalsCache?.goals ?? []);
  const [tasks, setTasks] = useState<Task[]>(goalsCache?.tasks ?? []);
  const [loading, setLoading] = useState(!goalsCache);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [groupByArea, setGroupByArea] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent && !goalsCache) setLoading(true);
      try {
        const [g, t] = await Promise.all([getGoals(user.uid), getTasks(user.uid)]);
        setGoals(g);
        setTasks(t);
        goalsCache = { goals: g, tasks: t };
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  const focusGoals = useMemo(() => goals.filter((g) => g.focus), [goals]);
  const otherGoals = useMemo(() => goals.filter((g) => !g.focus), [goals]);
  const activeCount = useMemo(
    () => goals.filter((g) => g.status === "active").length,
    [goals]
  );
  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  // Non-focus goals grouped by life area (for the "group by area" toggle).
  const groupedOther = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of otherGoals) {
      const key = categoryLabel(g.category) ?? "Uncategorized";
      const arr = map.get(key) ?? [];
      arr.push(g);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [otherGoals]);

  // Health stats for the header row.
  const stats = useMemo(() => {
    const active = goals.filter((g) => g.status === "active");
    const weekAgo = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return toDateKey(d);
    })();
    const atRisk = active.filter((g) => {
      if (goalStale(g, today)) return true;
      const p = goalPace(g, today);
      return p ? p.tone === "bad" || p.tone === "warn" : false;
    }).length;
    const vels = active
      .filter((g) => g.progressLog.length >= 2)
      .map((g) => goalMomentum(g, today).velocityPerWeek);
    const avgVelocity = vels.length
      ? Math.round((vels.reduce((a, b) => a + b, 0) / vels.length) * 10) / 10
      : null;
    const winsThisWeek = goals
      .flatMap((g) => g.milestones)
      .filter((m) => m.done && m.completedDate && m.completedDate >= weekAgo).length;
    const byId = new Map(goals.map((g) => [g.id, g]));
    const blocked = active.filter((g) => goalBlockers(g, byId).length > 0).length;
    return { active: active.length, atRisk, avgVelocity, winsThisWeek, blocked };
  }, [goals, today]);

  // Goals that have gone quiet — the stall radar.
  const stalled = useMemo(
    () =>
      goals
        .filter((g) => g.status === "active" && goalStale(g, today))
        .map((g) => ({ goal: g, m: goalMomentum(g, today) }))
        .sort((a, b) => (b.m.daysSinceGain ?? 9999) - (a.m.daysSinceGain ?? 9999))
        .slice(0, 5),
    [goals, today]
  );

  // Milestones completed in the last two weeks — the wins log.
  const recentWins = useMemo(() => {
    const twoWeeksAgo = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      return toDateKey(d);
    })();
    return goals
      .flatMap((g) =>
        g.milestones
          .filter((m) => m.done && m.completedDate && m.completedDate >= twoWeeksAgo)
          .map((m) => ({ goal: g, m }))
      )
      .sort((a, b) => ((a.m.completedDate ?? "") < (b.m.completedDate ?? "") ? 1 : -1))
      .slice(0, 6);
  }, [goals]);

  // Next action per goal.
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
    await load(true);
  }
  async function quickCount(goal: Goal, v: number) {
    await setGoalCurrentValue({ id: goal.id }, v);
    await load(true);
  }

  // Star / unstar — optimistic so the card jumps sections instantly.
  function toggleFocus(goal: Goal) {
    const next = !goal.focus;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, focus: next } : g)));
    void setGoalFocus(goal.id, next);
  }

  // Subtask add/toggle/remove — optimistic, then persist + refresh progress.
  async function handleSubtasksChange(goal: Goal, subtasks: GoalSubtask[]) {
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, subtasks } : g)));
    await updateGoalSubtasks(goal.id, subtasks);
    await load(true);
  }

  function actionKey(goalId: string, a: NextAction): string {
    if (a.kind === "subtask") return `${goalId}:st:${a.subtaskId}`;
    if (a.kind === "task") return `${goalId}:t:${a.taskId}`;
    if (a.kind === "step") return `${goalId}:s:${a.stepId}`;
    return `${goalId}:m:${a.milestoneId}`;
  }

  // Complete a goal's next action from the momentum strip.
  async function completeAction(goal: Goal, action: NextAction) {
    setCompleting(actionKey(goal.id, action));
    try {
      await completeGoalNextAction(goal, action);
      await load(true);
    } finally {
      setCompleting(null);
    }
  }

  const showFocusPrompt = !loading && focusGoals.length === 0 && goals.length > 0;

  const cardProps = (goal: Goal) => ({
    goal,
    today,
    blockers: goalBlockers(goal, goalsById),
    nextAction: nextActions.get(goal.id) ?? null,
    onToggleFocus: toggleFocus,
    onEdit: openEdit,
    onDelete: (g: Goal) => setDeleting(g),
    onQuickPercent: quickPercent,
    onQuickCount: quickCount,
    onSubtasksChange: handleSubtasksChange,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Goals"
        description={
          <>
            Focus on what matters, then do the next thing.
            {activeCount > 0 && ` · ${activeCount} active`}
          </>
        }
      >
        {!loading && goals.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setView("cards")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === "cards"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={view === "cards"}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === "table"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={view === "table"}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          )}
        {user && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New goal
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Add your first goal, then break it into projects and daily tasks."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add a goal
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Health stat row */}
          <div
            className={cn(
              "grid grid-cols-2 gap-3",
              stats.blocked > 0 ? "md:grid-cols-5" : "md:grid-cols-4"
            )}
          >
            <StatTile icon={Activity} label="Active" value={String(stats.active)} />
            <StatTile
              icon={AlertTriangle}
              label="At risk"
              value={String(stats.atRisk)}
              tone={stats.atRisk > 0 ? "amber" : "default"}
            />
            <StatTile
              icon={TrendingUp}
              label="Avg velocity"
              value={
                stats.avgVelocity == null
                  ? "—"
                  : `${stats.avgVelocity >= 0 ? "+" : ""}${stats.avgVelocity}%/wk`
              }
            />
            <StatTile
              icon={Trophy}
              label="Wins (7d)"
              value={String(stats.winsThisWeek)}
              tone={stats.winsThisWeek > 0 ? "emerald" : "default"}
            />
            {stats.blocked > 0 && (
              <StatTile icon={Lock} label="Blocked" value={String(stats.blocked)} tone="amber" />
            )}
          </div>

          {/* Focus prompt / WIP nudge (cards view) */}
          {view === "cards" && showFocusPrompt && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
              <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="text-sm">
                <p className="font-medium">
                  {activeCount > 5 ? `You have ${activeCount} active goals.` : "Pick your focus."}
                </p>
                <p className="text-muted-foreground">
                  Focus compounds — star your top 1–3 goals (the ☆ on each card). They rise to the
                  top and feed a daily momentum list.
                </p>
              </div>
            </div>
          )}

          {/* Today's Momentum — the daily driver (both views) */}
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

          {view === "table" ? (
            <GoalsTable
              goals={goals}
              goalsById={goalsById}
              today={today}
              onEdit={openEdit}
              onDelete={(g) => setDeleting(g)}
              onToggleFocus={toggleFocus}
              onChanged={() => load(true)}
            />
          ) : (
            <>
              {/* Stall radar + Wins */}
              {(stalled.length > 0 || recentWins.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {stalled.length > 0 && (
                    <Card className="border-amber-500/25">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4 text-amber-500" /> Stall radar
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stalled.length} goal{stalled.length > 1 ? "s" : ""} haven&apos;t moved
                          lately
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-0.5 pt-0">
                        {stalled.map(({ goal, m }) => (
                          <Link
                            key={goal.id}
                            href={`/goals/${goal.id}`}
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {goal.icon && <span aria-hidden>{goal.icon}</span>}
                              <span className="truncate">{goal.title}</span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                              {m.daysSinceGain != null ? `${m.daysSinceGain}d idle` : "no progress"}
                            </span>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {recentWins.length > 0 && (
                    <Card className="border-emerald-500/25">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Trophy className="h-4 w-4 text-emerald-500" /> Recent wins
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Milestones completed in the last 2 weeks
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-0.5 pt-0">
                        {recentWins.map(({ goal, m }) => (
                          <Link
                            key={m.id}
                            href={`/goals/${goal.id}`}
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              <span className="truncate">{m.title}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {m.completedDate ? shortDate(m.completedDate) : ""}
                            </span>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
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
                      <GoalCard key={goal.id} prominent {...cardProps(goal)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Everything else */}
              {otherGoals.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">
                        {focusGoals.length > 0 ? "More goals" : "Your goals"}
                      </h2>
                      <span className="text-xs text-muted-foreground">· {otherGoals.length}</span>
                    </div>
                    {groupedOther.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-muted-foreground"
                        onClick={() => setGroupByArea((v) => !v)}
                      >
                        {groupByArea ? (
                          <LayoutGrid className="h-3.5 w-3.5" />
                        ) : (
                          <Rows3 className="h-3.5 w-3.5" />
                        )}
                        {groupByArea ? "Ungroup" : "Group by area"}
                      </Button>
                    )}
                  </div>

                  {groupByArea ? (
                    <div className="space-y-6">
                      {groupedOther.map(([area, list]) => {
                        const avg = Math.round(
                          list.reduce((s, g) => s + g.progress, 0) / list.length
                        );
                        return (
                          <div key={area} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <h3 className="shrink-0 text-sm font-medium">{area}</h3>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {list.length}
                              </span>
                              <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${avg}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">{avg}%</span>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {list.map((goal) => (
                                <GoalCard key={goal.id} prominent={false} {...cardProps(goal)} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {otherGoals.map((goal) => (
                        <GoalCard key={goal.id} prominent={false} {...cardProps(goal)} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      {user && (
        <GoalFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          userId={user.uid}
          goal={editing}
          allGoals={goals}
          onSaved={() => load(true)}
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
            await load(true);
          }
        }}
      />
    </div>
  );
}
