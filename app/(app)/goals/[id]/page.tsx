"use client";

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
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoal,
  getProjectsForGoal,
  getTasksForGoal,
  deleteGoal,
  deleteProject,
  deleteTask,
} from "@/lib/firebase/db";
import {
  GOAL_STATUS_LABEL,
  GOAL_STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  CATEGORY_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
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
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal, Project, Task } from "@/lib/types";

export default function GoalDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const goalId = params.id;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const load = useCallback(async () => {
    if (!user || !goalId) return;
    setLoading(true);
    try {
      const [g, p, t] = await Promise.all([
        getGoal(goalId),
        getProjectsForGoal(goalId),
        getTasksForGoal(goalId),
      ]);
      setGoal(g);
      setProjects(p);
      setTasks(t);
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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  const dl = deadlineLabel(goal.deadline);
  const doneCount = tasks.filter((t) => t.status === "done").length;

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
            <h1 className="text-xl font-bold md:text-2xl">{goal.title}</h1>
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
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant={GOAL_STATUS_VARIANT[goal.status]}>
              {GOAL_STATUS_LABEL[goal.status]}
            </Badge>
            <Badge variant={PRIORITY_VARIANT[goal.priority]}>
              {PRIORITY_LABEL[goal.priority]}
            </Badge>
            {goal.category && (
              <Badge variant="outline">{CATEGORY_LABEL[goal.category]}</Badge>
            )}
            {goal.quarter && <Badge variant="secondary">{goal.quarter}</Badge>}
            {dl && <Badge variant="secondary">{dl}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {goal.description && (
            <p className="text-sm text-muted-foreground">{goal.description}</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Progress · {doneCount}/{tasks.length} tasks done
              </span>
              <span className="font-medium text-foreground">
                {goal.progress}%
              </span>
            </div>
            <Progress value={goal.progress} />
          </div>
        </CardContent>
      </Card>

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
