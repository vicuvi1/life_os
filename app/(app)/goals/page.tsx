"use client";

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
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getGoals, deleteGoal } from "@/lib/firebase/db";
import {
  GOAL_STATUS_LABEL,
  GOAL_STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  CATEGORY_LABEL,
  deadlineLabel,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  const { user } = useAuth();
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
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            const dl = deadlineLabel(goal.deadline);
            return (
              <Card key={goal.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="font-semibold hover:underline"
                    >
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
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant={GOAL_STATUS_VARIANT[goal.status]}>
                      {GOAL_STATUS_LABEL[goal.status]}
                    </Badge>
                    <Badge variant={PRIORITY_VARIANT[goal.priority]}>
                      {PRIORITY_LABEL[goal.priority]}
                    </Badge>
                    {goal.category && (
                      <Badge variant="outline">
                        {CATEGORY_LABEL[goal.category]}
                      </Badge>
                    )}
                    {dl && <Badge variant="secondary">{dl}</Badge>}
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
                      <span>Progress</span>
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
