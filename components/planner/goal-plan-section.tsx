"use client";

import { useCallback } from "react";
import { CalendarOff, Flag, ListTodo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/toast/toast-provider";
import { PlanTaskRow } from "@/components/planner/plan-task-row";
import { TaskQuickAdd, type QuickAddValues } from "@/components/planner/task-quick-add";
import { createTask } from "@/lib/firebase/db";
import { shortDate } from "@/lib/goals";
import { buildGoalPlan, isTaskDone } from "@/lib/planner";
import { deadlineWarning } from "@/lib/planner-actions";
import { usePlannerActions } from "@/lib/use-planner-actions";
import { cn } from "@/lib/utils";
import type { Goal, Task } from "@/lib/types";

interface Props {
  goal: Goal;
  /** Every task that belongs to this goal. */
  tasks: Task[];
  userId: string;
  today: string;
  /** Apply an optimistic change to the page's task list. */
  onMutate: (updater: (prev: Task[]) => Task[]) => void;
  /** Re-fetch quietly (no skeleton) after a write, or to roll back a failed one. */
  onRefresh: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

/**
 * The goal's plan: milestones in date order with their tasks, a quick-add under
 * each, and the backlog of tasks that don't have a day yet.
 */
export function GoalPlanSection({
  goal,
  tasks,
  userId,
  today,
  onMutate,
  onRefresh,
  onEditTask,
  onDeleteTask,
}: Props) {
  const { toast } = useToast();
  const plan = buildGoalPlan(goal, tasks);
  const hasMilestones = plan.groups.length > 0;

  const goalFor = useCallback(() => goal, [goal]);
  const actions = usePlannerActions({ mutate: onMutate, refresh: onRefresh, goalFor });

  async function addTask(values: QuickAddValues, milestoneId: string | null) {
    await createTask(userId, {
      title: values.title,
      description: null,
      priority: "medium",
      dueDate: values.dueDate,
      projectId: null,
      goalId: goal.id,
      milestoneId,
      estimatedMinutes: values.estimatedMinutes,
    });
    const warning = deadlineWarning(values.dueDate, goal);
    if (warning) toast({ message: warning, duration: 6000 });
    onRefresh();
  }

  const rowProps = {
    goal,
    today,
    onToggleDone: actions.toggleDone,
    onReschedule: actions.reschedule,
    onToggleTimer: actions.toggleTimer,
    onAddTime: actions.addTime,
    onEdit: onEditTask,
    onDelete: onDeleteTask,
  };

  return (
    <section className="space-y-3" aria-labelledby="goal-plan-heading">
      <h2
        id="goal-plan-heading"
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ListTodo className="h-4 w-4" /> Plan
        {tasks.length > 0 && (
          <span className="text-xs font-normal">
            · {tasks.filter(isTaskDone).length}/{tasks.length} tasks done
          </span>
        )}
      </h2>

      {/* Tasks under each milestone, in date order */}
      {plan.groups.map(({ milestone, tasks: mTasks }) => {
        const open = mTasks.filter((t) => !isTaskDone(t)).length;
        const missed = milestone.dueDate != null && milestone.dueDate < today && open > 0;
        return (
          <Card key={milestone.id}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-3 py-2.5 sm:px-4">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Flag
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      missed ? "text-destructive" : "text-muted-foreground"
                    )}
                  />
                  <span className={cn("truncate", milestone.done && "text-muted-foreground line-through")}>
                    {milestone.title}
                  </span>
                </p>
                <p className={cn("text-xs text-muted-foreground", missed && "text-destructive")}>
                  {milestone.dueDate ? shortDate(milestone.dueDate) : "No date"}
                  {missed && " · passed"}
                  {mTasks.length > 0 && ` · ${mTasks.length - open}/${mTasks.length}`}
                </p>
              </div>
              {mTasks.length > 0 ? (
                <div className="divide-y">
                  {mTasks.map((t) => (
                    <PlanTaskRow key={t.id} task={t} {...rowProps} />
                  ))}
                </div>
              ) : (
                <p className="px-3 pt-3 text-xs text-muted-foreground sm:px-4">
                  No tasks yet — what&apos;s the first step toward this milestone?
                </p>
              )}
              <div className={cn(mTasks.length > 0 && "border-t")}>
                <TaskQuickAdd
                  idSuffix={milestone.id}
                  goal={goal}
                  placeholder={`Add a task to “${milestone.title}”…`}
                  onAdd={(v) => addTask(v, milestone.id)}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Tasks without a milestone */}
      <Card>
        <CardContent className="p-0">
          {hasMilestones && (
            <p className="border-b px-3 py-2.5 text-sm font-semibold sm:px-4">No milestone</p>
          )}
          {plan.ungrouped.length > 0 ? (
            <div className="divide-y">
              {plan.ungrouped.map((t) => (
                <PlanTaskRow key={t.id} task={t} {...rowProps} />
              ))}
            </div>
          ) : (
            tasks.length === 0 && (
              <div className="px-4 pb-1 pt-6 text-center">
                <p className="text-sm font-medium">No tasks yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Break this goal into small tasks, then give each one a day. Tasks with a
                  day show up on Today and the calendar.
                </p>
              </div>
            )
          )}
          <div className={cn(plan.ungrouped.length > 0 && "border-t")}>
            <TaskQuickAdd idSuffix="ungrouped" goal={goal} onAdd={(v) => addTask(v, null)} />
          </div>
        </CardContent>
      </Card>

      {/* Backlog: open tasks with no day yet */}
      <div className="space-y-2 pt-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CalendarOff className="h-4 w-4" /> Unscheduled backlog
          {plan.backlog.length > 0 && (
            <span className="text-xs font-normal">· {plan.backlog.length}</span>
          )}
        </h3>
        <Card>
          <CardContent className="p-0">
            {plan.backlog.length > 0 ? (
              <div className="divide-y">
                {plan.backlog.map((t) => (
                  <PlanTaskRow
                    key={t.id}
                    task={t}
                    {...rowProps}
                    context={
                      goal.milestones.find((m) => m.id === t.milestoneId)?.title ?? null
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {tasks.length === 0
                  ? "Tasks you add without a day will wait here."
                  : "Nothing waiting — every open task has a day."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
