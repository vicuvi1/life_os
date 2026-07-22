"use client";

import { useState } from "react";
import { CalendarClock, Clock, Flame, ListTodo, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_LANES,
  durationLabel,
  finishLabel,
  laneForTask,
  sortDayTasks,
  summarizeDay,
  type LaneKey,
} from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import type { Task } from "@/lib/types";

interface Props {
  date: string;
  tasks: Task[];
  goalTitle: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task, done: boolean) => void;
  onReschedule: (taskId: string, date: string, lane: LaneKey) => void;
  onAdd: (date: string, lane: LaneKey) => void;
}

export function TaskTodayView({
  date,
  tasks,
  goalTitle,
  onOpen,
  onToggleDone,
  onReschedule,
  onAdd,
}: Props) {
  const [over, setOver] = useState<LaneKey | null>(null);
  const summary = summarizeDay(tasks);
  const finish = finishLabel(summary);

  return (
    <div className="space-y-5">
      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<ListTodo className="h-4 w-4" />} value={`${summary.open}`} label={summary.open === 1 ? "task open" : "tasks open"} />
        <Stat icon={<Clock className="h-4 w-4" />} value={durationLabel(summary.blockedMin) || "0h"} label="time blocked" />
        <Stat icon={<Flame className="h-4 w-4" />} value={`${summary.highOpen}`} label="high priority" />
        <Stat icon={<CalendarClock className="h-4 w-4" />} value={finish ?? "—"} label="est. finish" />
      </div>

      {/* Schedule by block */}
      <div className="space-y-3">
        {DAY_LANES.map((lane) => {
          const laneTasks = sortDayTasks(tasks.filter((t) => laneForTask(t) === lane.key));
          const isOver = over === lane.key;
          return (
            <div
              key={lane.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== lane.key) setOver(lane.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setOver((o) => (o === lane.key ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onReschedule(id, date, lane.key);
              }}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                isOver && "border-primary/60 bg-primary/5"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{lane.label}</h3>
                  <span className="text-xs text-muted-foreground">{lane.hint}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(date, lane.key)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {laneTasks.length > 0 ? (
                <div className="space-y-1.5">
                  {laneTasks.map((t) => (
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
                <p className="py-1 text-xs text-muted-foreground/60">Nothing here — drag a task in or add one.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xl font-bold leading-none tabular-nums">
        <span className="text-muted-foreground">{icon}</span>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
