"use client";

import { useMemo, useState } from "react";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskRow } from "@/components/tasks/task-row";
import { sortDayTasks } from "@/lib/tasks";
import type { Task } from "@/lib/types";

type Filter = "open" | "today" | "overdue" | "high" | "done" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "high", label: "High priority" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

interface Props {
  tasks: Task[];
  today: string;
  goalTitle: (id: string | null) => string | null;
  onChanged: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskListView({
  tasks,
  today,
  goalTitle,
  onChanged,
  onEdit,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<Filter>("open");

  const filtered = useMemo(() => {
    const list = tasks.filter((t) => {
      switch (filter) {
        case "all":
          return true;
        case "open":
          return t.status !== "done";
        case "done":
          return t.status === "done";
        case "high":
          return t.status !== "done" && t.priority === "high";
        case "today":
          return t.status !== "done" && t.dueDate === today;
        case "overdue":
          return t.status !== "done" && t.dueDate !== null && t.dueDate < today;
        default:
          return true;
      }
    });
    // Sort: by due date (undated last), then time/priority within a day.
    return list.sort((a, b) => {
      const da = a.dueDate ?? "9999-99-99";
      const db = b.dueDate ?? "9999-99-99";
      if (da !== db) return da < db ? -1 : 1;
      return sortDayTasks([a, b])[0] === a ? -1 : 1;
    });
  }, [tasks, filter, today]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <ListTodo className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No tasks here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try another filter, or add a task from the toolbar above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onChanged={onChanged}
                onEdit={onEdit}
                onDelete={onDelete}
                context={goalTitle(t.goalId)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
