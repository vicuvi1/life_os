"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  FolderKanban,
  ListTodo,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoal,
  getProjectsForGoal,
  getTasksForGoal,
  getSessions,
  recomputeGoalProgress,
  updateGoalJournal,
  deleteGoal,
  deleteProject,
  deleteTask,
} from "@/lib/firebase/db";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
} from "@/lib/labels";
import {
  computeGoalProgress,
  goalPace,
  goalProgressDetail,
  goalTrend,
  shortDate,
  type PaceInfo,
} from "@/lib/goals";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { GoalBadges } from "@/components/goals/goal-badges";
import { MilestonesSection } from "@/components/goals/milestones-section";
import { TrendChart } from "@/components/sleep/trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal, Project, Session, Task } from "@/lib/types";

function paceClass(tone: PaceInfo["tone"]): string {
  switch (tone) {
    case "good":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
    case "warn":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
    case "bad":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function GoalDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const goalId = params.id;
  const today = toDateKey(new Date());

  const [goal, setGoal] = useState<Goal | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(false);

  const [projectForm, setProjectForm] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const [taskForm, setTaskForm] = useState<{
    open: boolean;
    projectId: string | null;
    task: Task | null;
  }>({ open: false, projectId: null, task: null });
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [journalDraft, setJournalDraft] = useState("");

  const load = useCallback(async () => {
    if (!user || !goalId) return;
    setLoading(true);
    try {
      // Snapshot today's progress so the history/pace reflect the latest state
      // (idempotent — one daily entry, deduped).
      await recomputeGoalProgress(goalId).catch(() => {});
      const [g, p, t, se] = await Promise.all([
        getGoal(goalId),
        getProjectsForGoal(goalId),
        getTasksForGoal(goalId),
        getSessions(user.uid),
      ]);
      setGoal(g);
      setProjects(p);
      setTasks(t);
      setSessions(se);
    } finally {
      setLoading(false);
    }
  }, [user, goalId]);

  useEffect(() => {
    load();
  }, [load]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.projectId ?? "__none__";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const looseTasks = tasksByProject.get("__none__") ?? [];

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-muted-foreground">Goal not found.</p>
        <Button asChild variant="outline">
          <Link href="/goals">
            <ArrowLeft className="h-4 w-4" /> Back to goals
          </Link>
        </Button>
      </div>
    );
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const linkedMinutes = sessions
    .filter((s) => s.goalId === goal.id)
    .reduce((sum, s) => sum + Math.max(0, s.endMin - s.startMin), 0);
  const progressCtx = {
    taskDone: doneCount,
    taskTotal: tasks.length,
    linkedMinutes,
  };
  const livePct = computeGoalProgress(goal, progressCtx);
  const progressDetail = goalProgressDetail(goal, progressCtx);
  const pace = goalPace(goal, today);
  const trend = goalTrend(goal);
  const hasHistory = goal.progressLog.length >= 2;
  const goalSessions = sessions
    .filter((s) => s.goalId === goal.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  async function addJournal() {
    if (!goal || !journalDraft.trim()) return;
    const entry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `j_${Date.now()}`,
      date: today,
      text: journalDraft.trim(),
      createdAt: Date.now(),
    };
    await updateGoalJournal(goal.id, [entry, ...goal.journal]);
    setJournalDraft("");
    await load();
  }
  async function removeJournal(id: string) {
    if (!goal) return;
    await updateGoalJournal(
      goal.id,
      goal.journal.filter((j) => j.id !== id)
    );
    await load();
  }

  function openAddTask(projectId: string | null) {
    setTaskForm({ open: true, projectId, task: null });
  }
  function openEditTask(task: Task) {
    setTaskForm({ open: true, projectId: task.projectId, task });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/goals">
          <ArrowLeft className="h-4 w-4" /> Goals
        </Link>
      </Button>

      {/* Goal header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
              {goal.icon && <span aria-hidden>{goal.icon}</span>}
              {goal.title}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Goal actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setGoalFormOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit goal
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeletingGoal(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete goal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <GoalBadges goal={goal} />
            {goal.quarter && <Badge variant="secondary">{goal.quarter}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {goal.description && (
            <p className="text-sm text-muted-foreground">{goal.description}</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{progressDetail ?? "Progress"}</span>
              <span className="font-medium text-foreground">{livePct}%</span>
            </div>
            <Progress value={livePct} />
          </div>
        </CardContent>
      </Card>

      {/* Progress over time (M3) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Progress over time</p>
            <div className="flex items-center gap-2">
              {trend && trend.direction !== "flat" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium",
                    trend.direction === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {trend.direction === "up" ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(trend.delta)}% / wk
                </span>
              )}
              {pace && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    paceClass(pace.tone)
                  )}
                >
                  {pace.label}
                </span>
              )}
            </div>
          </div>
          {pace?.detail && (
            <p className="text-xs text-muted-foreground">{pace.detail}</p>
          )}
          {!pace && goal.deadline && (
            <p className="text-xs text-muted-foreground">
              Not enough history yet for a pace estimate.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {hasHistory ? (
            <TrendChart
              categories={goal.progressLog.map((e) => shortDate(e.date))}
              series={[
                {
                  label: "Progress",
                  color: goal.color ?? "#8b5cf6",
                  points: goal.progressLog.map((e) => e.value),
                },
              ]}
              min={0}
              max={100}
              format={(n) => `${Math.round(n)}%`}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Progress history will appear here as you update this goal.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Milestones (micro-goals) */}
      <MilestonesSection goal={goal} tasks={tasks} onSaved={load} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setProjectForm({ open: true, project: null })}
        >
          <Plus className="h-4 w-4" /> Add project
        </Button>
        <Button variant="outline" onClick={() => openAddTask(null)}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      {/* Loose tasks (not under a project) */}
      {looseTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ListTodo className="h-4 w-4" /> Tasks
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {looseTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onChanged={load}
                  onEdit={openEditTask}
                  onDelete={setDeletingTask}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Projects */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <FolderKanban className="h-4 w-4" /> Projects
        </h2>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No projects yet. Break this goal into a few projects.
              </p>
              <Button
                size="sm"
                onClick={() => setProjectForm({ open: true, project: null })}
              >
                <Plus className="h-4 w-4" /> Add project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const pTasks = tasksByProject.get(project.id) ?? [];
              return (
                <Card key={project.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{project.title}</p>
                        {project.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
                          {PROJECT_STATUS_LABEL[project.status]}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Project actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setProjectForm({ open: true, project })
                              }
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingProject(project)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {pTasks.length > 0 && (
                      <div className="divide-y border-t">
                        {pTasks.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            onChanged={load}
                            onEdit={openEditTask}
                            onDelete={setDeletingTask}
                          />
                        ))}
                      </div>
                    )}
                    <div className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => openAddTask(project.id)}
                      >
                        <Plus className="h-4 w-4" /> Add task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Linked sessions (time logged toward this goal) */}
      {goalSessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            Linked sessions
            <span className="text-xs font-normal">
              · {(linkedMinutes / 60).toFixed(1)}h across {goalSessions.length}
            </span>
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {goalSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="truncate">{s.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {shortDate(s.date)} ·{" "}
                    {(Math.max(0, s.endMin - s.startMin) / 60).toFixed(1)}h
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Journal / reflections */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Journal</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex gap-2">
              <Textarea
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder="A reflection on this goal — what's working, what's stuck…"
                className="min-h-[60px]"
              />
              <Button
                type="button"
                className="self-end"
                disabled={!journalDraft.trim()}
                onClick={addJournal}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {goal.journal.length > 0 && (
              <div className="space-y-2">
                {goal.journal.map((j) => (
                  <div key={j.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {shortDate(j.date)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeJournal(j.id)}
                        aria-label="Delete entry"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{j.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Dialogs */}
      {user && (
        <>
          <GoalFormDialog
            open={goalFormOpen}
            onOpenChange={setGoalFormOpen}
            userId={user.uid}
            goal={goal}
            onSaved={load}
          />
          <ProjectFormDialog
            open={projectForm.open}
            onOpenChange={(o) =>
              setProjectForm((s) => ({ ...s, open: o }))
            }
            userId={user.uid}
            goalId={goal.id}
            project={projectForm.project}
            onSaved={load}
          />
          <TaskFormDialog
            open={taskForm.open}
            onOpenChange={(o) => setTaskForm((s) => ({ ...s, open: o }))}
            userId={user.uid}
            goalId={goal.id}
            projectId={taskForm.projectId}
            task={taskForm.task}
            onSaved={load}
          />
        </>
      )}

      <ConfirmDialog
        open={deletingGoal}
        onOpenChange={setDeletingGoal}
        title="Delete this goal?"
        description="This permanently deletes the goal and all its projects and tasks."
        onConfirm={async () => {
          await deleteGoal(goal.id);
          router.replace("/goals");
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingProject)}
        onOpenChange={(o) => !o && setDeletingProject(null)}
        title="Delete this project?"
        description="This deletes the project and its tasks. Goal progress will be recalculated."
        onConfirm={async () => {
          if (deletingProject) {
            await deleteProject(deletingProject.id);
            setDeletingProject(null);
            await load();
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(o) => !o && setDeletingTask(null)}
        title="Delete this task?"
        onConfirm={async () => {
          if (deletingTask) {
            await deleteTask({
              id: deletingTask.id,
              goalId: deletingTask.goalId,
            });
            setDeletingTask(null);
            await load();
          }
        }}
      />
    </div>
  );
}
