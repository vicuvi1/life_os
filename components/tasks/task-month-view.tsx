"use client";

import { monthGrid, isInMonth, dayNum, formatLongDate, WEEKDAYS_SHORT } from "@/lib/dates";
import { PRIORITY_ACCENT, sortDayTasks } from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/lib/types";

interface Props {
  year: number;
  month: number;
  today: string;
  selected: string;
  onSelect: (key: string) => void;
  tasksByDate: Map<string, Task[]>;
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
}

export function TaskMonthView({
  year,
  month,
  today,
  selected,
  onSelect,
  tasksByDate,
  goalTitle,
  onOpen,
  onToggleDone,
}: Props) {
  const grid = monthGrid(year, month);
  const selectedTasks = sortDayTasks(tasksByDate.get(selected) ?? []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {grid.flat().map((key) => {
          const inMonth = isInMonth(key, year, month);
          const dayTasks = tasksByDate.get(key) ?? [];
          const open = dayTasks.filter((t) => t.status !== "done");
          const isToday = key === today;
          const isSelected = key === selected;
          // Up to three dots, highest-priority first.
          const dots = sortByPriority(open).slice(0, 3);
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "flex min-h-[62px] flex-col items-center gap-1 rounded-lg border p-1 text-sm transition-colors sm:min-h-[76px]",
                inMonth ? "hover:border-primary/50" : "text-muted-foreground/40",
                isSelected ? "border-primary bg-primary/5" : "border-transparent"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {dayNum(key)}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-0.5">
                {dots.map((t) => (
                  <span
                    key={t.id}
                    className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_ACCENT[t.priority].dot)}
                  />
                ))}
                {open.length > 3 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{open.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {formatLongDate(selected)}
        </h2>
        {selectedTasks.length > 0 ? (
          <div className="space-y-1.5">
            {selectedTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={onOpen}
                onToggleDone={onToggleDone}
                context={goalTitle(t.goalId)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled this day.
          </p>
        )}
      </section>
    </div>
  );
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}
