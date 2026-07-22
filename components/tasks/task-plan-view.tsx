"use client";

import { useState } from "react";
import { Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORITY_ACCENT, type LaneKey } from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskWeekView } from "@/components/tasks/task-week-view";
import type { Task } from "@/lib/types";

const RANK = { high: 0, medium: 1, low: 2 } as const;

interface Props {
  weekDates: string[];
  today: string;
  tasksByDate: Map<string, Task[]>;
  backlog: Task[]; // undated, open
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onReschedule: (taskId: string, date: string, lane: LaneKey) => void;
  onUnschedule: (taskId: string) => void;
  onAdd: (date: string, lane: LaneKey) => void;
  onAutoSchedule: () => void;
  autoScheduling: boolean;
}

export function TaskPlanView({
  weekDates,
  today,
  tasksByDate,
  backlog,
  goalTitle,
  onOpen,
  onToggleDone,
  onReschedule,
  onUnschedule,
  onAdd,
  onAutoSchedule,
  autoScheduling,
}: Props) {
  const [over, setOver] = useState(false);
  const sorted = [...backlog].sort((a, b) => {
    if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Backlog */}
      <div className="lg:w-72 lg:shrink-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!over) setOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const id = e.dataTransfer.getData("text/plain");
            if (id) onUnschedule(id);
          }}
          className={cn(
            "rounded-xl border p-3 transition-colors",
            over && "border-primary/60 bg-primary/5"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Backlog</h3>
              <span className="text-xs text-muted-foreground">({sorted.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoSchedule}
              disabled={autoScheduling || sorted.length === 0}
              title="Fill free work-hour slots by priority"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {autoScheduling ? "Scheduling…" : "Auto-schedule"}
            </Button>
          </div>

          {sorted.length > 0 ? (
            <div className="space-y-1.5">
              {sorted.map((t) => (
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
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <span className={cn("h-2 w-2 rounded-full", PRIORITY_ACCENT.low.dot)} />
              <p className="text-sm font-medium">Backlog clear</p>
              <p className="max-w-[12rem] text-xs text-muted-foreground">
                Undated tasks land here. Drag a task off the week to send it back.
              </p>
            </div>
          )}
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Drag a task onto any day and time block to schedule it.
        </p>
      </div>

      {/* Week grid */}
      <div className="min-w-0 flex-1">
        <TaskWeekView
          weekDates={weekDates}
          today={today}
          tasksByDate={tasksByDate}
          goalTitle={goalTitle}
          onOpen={onOpen}
          onToggleDone={onToggleDone}
          onReschedule={onReschedule}
          onAdd={onAdd}
        />
      </div>
    </div>
  );
}
