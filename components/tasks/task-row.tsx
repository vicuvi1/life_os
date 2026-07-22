"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Pencil, Trash2, CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTaskDone } from "@/lib/firebase/db";
import { PRIORITY_LABEL, PRIORITY_VARIANT, deadlineLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface Props {
  task: Task;
  onChanged: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Optional trailing context label (e.g. the goal title). */
  context?: string | null;
}

export function TaskRow({ task, onChanged, onEdit, onDelete, context }: Props) {
  const [popping, setPopping] = useState(false);
  // Optimistic override: the checkbox flips immediately; the server write
  // happens in the background and rolls back only on failure.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  // Fresh server data supersedes any local override.
  useEffect(() => {
    setOptimistic(null);
  }, [task.status]);
  const done = optimistic ?? task.status === "done";
  const dl = deadlineLabel(task.dueDate);
  const overdue = !done && dl?.includes("overdue");

  async function toggle(checked: boolean) {
    setOptimistic(checked);
    if (checked) {
      setPopping(true);
      setTimeout(() => setPopping(false), 260);
    }
    try {
      await setTaskDone({ id: task.id, goalId: task.goalId }, checked);
      onChanged();
    } catch {
      setOptimistic(null); // rollback on failure
    }
  }

  return (
    <div className="group animate-fade-slide-in flex items-start gap-3 rounded-lg px-4 py-3 transition-colors duration-150 ease-smooth hover:bg-accent/40">
      <span className={cn("mt-0.5", popping && "animate-pop")}>
        <Checkbox
          checked={done}
          onCheckedChange={(c) => toggle(Boolean(c))}
          aria-label={done ? "Mark as not done" : "Mark as done"}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {task.description && !done && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {!done && (
            <Badge variant={PRIORITY_VARIANT[task.priority]}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          )}
          {dl && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs text-muted-foreground",
                overdue && "text-destructive"
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {dl}
            </span>
          )}
          {context && (
            <span className="truncate text-xs text-muted-foreground">
              · {context}
            </span>
          )}
        </div>
      </div>

      {(onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 transition-opacity duration-150 ease-smooth focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Task actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
