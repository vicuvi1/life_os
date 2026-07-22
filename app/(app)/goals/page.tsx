"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getGoals, deleteGoal } from "@/lib/firebase/db";
import { goalProgressDetail, goalStale } from "@/lib/goals";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { GoalBadges } from "@/components/goals/goal-badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setGoals(await getGoals(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Goals</h1>
          <p className="text-muted-foreground">
            Your goals, broken into projects and tasks.
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
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            return (
              <Card
                key={goal.id}
                className="flex flex-col overflow-hidden"
                style={
                  goal.color
                    ? { borderLeft: `3px solid ${goal.color}` }
                    : undefined
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="flex items-center gap-2 font-semibold hover:underline"
                    >
                      {goal.icon && <span aria-hidden>{goal.icon}</span>}
                      {goal.title}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mr-2 -mt-1 h-8 w-8"
                          aria-label="Goal actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
                  {goal.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{goalProgressDetail(goal) ?? "Progress"}</span>
                      <span className="font-medium text-foreground">
                        {goal.progress}%
                      </span>
                    </div>
                    <Progress value={goal.progress} />
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                  >
                    <Link href={`/goals/${goal.id}`}>
                      Open projects & tasks
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
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
