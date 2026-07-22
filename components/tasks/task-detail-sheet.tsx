"use client";

import {
  CalendarDays,
  Clock,
  FolderKanban,
  Target,
  Zap,
  MapPin,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatLongDate } from "@/lib/dates";
import { PRIORITY_VARIANT, PRIORITY_LABEL } from "@/lib/labels";
import {
  PRIORITY_ACCENT,
  durationLabel,
  taskDurationMin,
  taskTimeLabel,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "Open",
  in_progress: "In progress",
  done: "Done",
};

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalTitle: string | null;
  projectTitle: string | null;
  onToggleDone: (task: Task, done: boolean) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  goalTitle,
  projectTitle,
  onToggleDone,
  onToggleSubtask,
  onEdit,
  onDelete,
}: Props) {
  if (!task) return null;
  const done = task.status === "done";
  const accent = PRIORITY_ACCENT[task.priority];
  const time = taskTimeLabel(task);
  const dur = durationLabel(taskDurationMin(task));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-0">
        <SheetHeader className="border-b p-5 pr-12">
          <div className="flex items-start gap-2.5">
            <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", accent.dot)} />
            <SheetTitle className={cn(done && "text-muted-foreground line-through")}>
              {task.title}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="space-y-1 p-5">
          <Row label="Status">
            <Badge variant={done ? "success" : "secondary"}>
              {STATUS_LABEL[task.status]}
            </Badge>
          </Row>
          <Row label="Priority">
            <Badge variant={PRIORITY_VARIANT[task.priority]}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          </Row>
          <Row label="Date" icon={<CalendarDays className="h-3.5 w-3.5" />}>
            {task.dueDate ? formatLongDate(task.dueDate) : "Unscheduled"}
          </Row>
          {time && (
            <Row label="Time" icon={<Clock className="h-3.5 w-3.5" />}>
              {time}
              {dur && <span className="text-muted-foreground"> · {dur}</span>}
            </Row>
          )}
          {goalTitle && (
            <Row label="Goal" icon={<Target className="h-3.5 w-3.5" />}>
              {goalTitle}
            </Row>
          )}
          {projectTitle && (
            <Row label="Project" icon={<FolderKanban className="h-3.5 w-3.5" />}>
              {projectTitle}
            </Row>
          )}
          {task.energy != null && (
            <Row label="Energy" icon={<Zap className="h-3.5 w-3.5" />}>
              {task.energy}/10
            </Row>
          )}
          {task.location && (
            <Row label="Location" icon={<MapPin className="h-3.5 w-3.5" />}>
              {task.location}
            </Row>
          )}
          {task.tags.length > 0 && (
            <Row label="Tags">
              <div className="flex flex-wrap justify-end gap-1">
                {task.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Row>
          )}
        </div>

        {task.description && (
          <div className="border-t px-5 py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="whitespace-pre-wrap text-sm">{task.description}</p>
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div className="border-t px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subtasks
            </p>
            <div className="space-y-1.5">
              {task.subtasks.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={s.done}
                    onCheckedChange={() => onToggleSubtask(task, s.id)}
                    aria-label={s.title}
                  />
                  <span className={cn("flex-1", s.done && "text-muted-foreground line-through")}>
                    {s.title}
                  </span>
                  {s.durationMin != null && (
                    <span className="text-xs text-muted-foreground">
                      {durationLabel(s.durationMin)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t p-5">
          <Button
            variant={done ? "outline" : "default"}
            size="sm"
            onClick={() => onToggleDone(task, !done)}
          >
            {done ? (
              <>
                <RotateCcw className="h-4 w-4" /> Reopen
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Complete
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(task);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
