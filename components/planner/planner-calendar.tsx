"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarOff, Diamond, Flag, GripVertical } from "lucide-react";
import { WEEKDAYS_SHORT, dayNum, formatLongDate, isInMonth } from "@/lib/dates";
import {
  dayLoadMin,
  isAfterDeadline,
  isOverLimit,
  isTaskDone,
  isTaskOverdue,
  minutesLabel,
  sortPlanTasks,
  taskEstimateMin,
} from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Goal, Task } from "@/lib/types";

export interface DayMarker {
  kind: "deadline" | "milestone";
  title: string;
  color: string | null;
}

interface Props {
  view: "month" | "week";
  /** Date keys to render: 42 for a month grid, 7 for a week. */
  days: string[];
  /** For month view, to dim days outside the month. */
  year: number;
  month: number;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  /** Open (not done) and done tasks that have a day. */
  tasksByDate: Map<string, Task[]>;
  unscheduled: Task[];
  markersByDate: Map<string, DayMarker[]>;
  goalsById: Map<string, Goal>;
  limitMin: number;
  onReschedule: (task: Task, date: string | null) => void;
  onOpenTask: (task: Task) => void;
}

// Drop on the day under the pointer (not whichever cell the dragged chip's box
// overlaps most); keyboard drags have no pointer, so fall back to overlap.
const dropTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const UNSCHEDULED = "unscheduled";
const dayId = (date: string) => `day:${date}`;

/**
 * Month / week planner grid with an "unscheduled" tray. Tasks are colored by
 * goal and can be dragged between days (mouse, touch or keyboard); dropping on
 * the tray unschedules. Each day shows its total estimated minutes and turns
 * amber above the daily limit.
 */
export function PlannerCalendar({
  view,
  days,
  year,
  month,
  today,
  selected,
  onSelect,
  tasksByDate,
  unscheduled,
  markersByDate,
  goalsById,
  limitMin,
  onReschedule,
  onOpenTask,
}: Props) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press and hold briefly, so scrolling the page still works.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const allTasks = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of unscheduled) map.set(t.id, t);
    tasksByDate.forEach((list) => list.forEach((t) => map.set(t.id, t)));
    return map;
  }, [tasksByDate, unscheduled]);

  // A drop can end with the pointer over the moved chip, which the browser
  // reports as a click on it — ignore clicks for a moment after any drag.
  const draggedAt = useRef(0);
  const openTask = useCallback(
    (task: Task) => {
      if (Date.now() - draggedAt.current > 350) onOpenTask(task);
    },
    [onOpenTask]
  );

  function onDragStart(e: DragStartEvent) {
    setDragging(allTasks.get(String(e.active.id)) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    draggedAt.current = Date.now();
    setDragging(null);
    const task = allTasks.get(String(e.active.id));
    const over = e.over ? String(e.over.id) : null;
    if (!task || !over) return;
    if (over === UNSCHEDULED) onReschedule(task, null);
    else if (over.startsWith("day:")) onReschedule(task, over.slice(4));
  }

  const goalOf = (t: Task) => (t.goalId ? goalsById.get(t.goalId) ?? null : null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropTarget}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          {view === "month" ? (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS_SHORT.map((d) => (
                <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {days.map((date) => (
                <DayCell
                  key={date}
                  date={date}
                  compact
                  dim={!isInMonth(date, year, month)}
                  isToday={date === today}
                  isSelected={date === selected}
                  tasks={tasksByDate.get(date) ?? []}
                  markers={markersByDate.get(date) ?? []}
                  limitMin={limitMin}
                  today={today}
                  goalOf={goalOf}
                  onSelect={onSelect}
                  onOpenTask={openTask}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-7 md:gap-1">
              {days.map((date) => (
                <DayCell
                  key={date}
                  date={date}
                  compact={false}
                  dim={false}
                  isToday={date === today}
                  isSelected={date === selected}
                  tasks={tasksByDate.get(date) ?? []}
                  markers={markersByDate.get(date) ?? []}
                  limitMin={limitMin}
                  today={today}
                  goalOf={goalOf}
                  onSelect={onSelect}
                  onOpenTask={openTask}
                />
              ))}
            </div>
          )}
        </div>

        <UnscheduledTray tasks={unscheduled} goalOf={goalOf} onOpenTask={openTask} today={today} />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="pointer-events-none max-w-[14rem] rotate-1 shadow-lg">
            <ChipBody task={dragging} goal={goalOf(dragging)} today={today} full />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
function DayCell({
  date,
  compact,
  dim,
  isToday,
  isSelected,
  tasks,
  markers,
  limitMin,
  today,
  goalOf,
  onSelect,
  onOpenTask,
}: {
  date: string;
  compact: boolean;
  dim: boolean;
  isToday: boolean;
  isSelected: boolean;
  tasks: Task[];
  markers: DayMarker[];
  limitMin: number;
  today: string;
  goalOf: (t: Task) => Goal | null;
  onSelect: (date: string) => void;
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId(date) });
  const sorted = sortPlanTasks(tasks);
  const open = sorted.filter((t) => !isTaskDone(t));
  const load = dayLoadMin(open);
  const over = isOverLimit(load, limitMin);
  const max = compact ? 3 : sorted.length;
  const shown = sorted.slice(0, max);
  const hidden = sorted.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`${formatLongDate(date)}: ${open.length} open ${
        open.length === 1 ? "task" : "tasks"
      }${load > 0 ? `, ${minutesLabel(load)} planned` : ""}${over ? ", over your daily limit" : ""}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(date)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(date);
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-lg border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-1.5",
        compact ? "min-h-[64px] sm:min-h-[104px]" : "min-h-[72px] md:min-h-[320px]",
        dim && "opacity-45",
        over ? "border-amber-500/50 bg-amber-500/[0.07]" : "border-border/60",
        isSelected && "border-primary ring-1 ring-primary/40",
        isOver && "border-primary bg-primary/10"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs",
            isToday && "bg-primary font-semibold text-primary-foreground"
          )}
        >
          {compact ? dayNum(date) : formatLongDate(date)}
        </span>
        {load > 0 && (
          <span
            className={cn(
              "text-[10px] tabular-nums text-muted-foreground",
              over && "font-semibold text-amber-600 dark:text-amber-400",
              compact && "hidden sm:inline"
            )}
            title={over ? `Over your ${minutesLabel(limitMin)} limit` : "Estimated minutes"}
          >
            {minutesLabel(load)}
          </span>
        )}
      </div>

      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {markers.map((m, i) => (
            <span
              key={i}
              title={`${m.kind === "deadline" ? "Deadline" : "Milestone"}: ${m.title}`}
              className={cn(
                "inline-flex max-w-full items-center gap-0.5 rounded px-0.5 text-[10px] font-medium",
                m.kind === "deadline" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "text-muted-foreground"
              )}
            >
              {m.kind === "deadline" ? (
                <Flag className="h-3 w-3 shrink-0" style={m.color ? { color: m.color } : undefined} />
              ) : (
                <Diamond className="h-2.5 w-2.5 shrink-0" style={m.color ? { color: m.color, fill: m.color } : undefined} />
              )}
              <span className={cn("truncate", compact && "hidden sm:inline")}>{m.title}</span>
            </span>
          ))}
        </div>
      )}

      {/* Phones in month view: dots only — tap the day to see and move tasks. */}
      {compact && sorted.length > 0 && (
        <div className="flex flex-wrap gap-0.5 sm:hidden">
          {sorted.slice(0, 6).map((t) => (
            <span
              key={t.id}
              className={cn("h-1.5 w-1.5 rounded-full", isTaskDone(t) && "opacity-30")}
              style={{ backgroundColor: goalOf(t)?.color ?? "hsl(var(--muted-foreground))" }}
            />
          ))}
        </div>
      )}
      <div className={cn("flex flex-col gap-0.5", compact && "hidden sm:flex")}>
        {shown.map((t) => (
          <TaskChip key={t.id} task={t} goal={goalOf(t)} today={today} onOpen={onOpenTask} />
        ))}
        {hidden > 0 && <span className="px-1 text-[10px] text-muted-foreground">+{hidden} more</span>}
      </div>
    </div>
  );
}

function ChipBody({
  task,
  goal,
  today,
  full = false,
}: {
  task: Task;
  goal: Goal | null;
  today: string;
  full?: boolean;
}) {
  const done = isTaskDone(task);
  const est = minutesLabel(taskEstimateMin(task));
  return (
    <span
      className={cn(
        "flex w-full items-center gap-1 rounded border-l-[3px] bg-card px-1 py-0.5 text-[11px] leading-tight",
        full && "border border-l-[3px] px-2 py-1.5 text-xs",
        done && "text-muted-foreground line-through opacity-60",
        !done && isTaskOverdue(task, today) && "text-destructive",
        !done && isAfterDeadline(task.dueDate, goal) && "text-amber-600 dark:text-amber-400"
      )}
      style={{ borderLeftColor: goal?.color ?? "hsl(var(--muted-foreground))" }}
    >
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {est && full && <span className="shrink-0 text-muted-foreground">{est}</span>}
    </span>
  );
}

function TaskChip({
  task,
  goal,
  today,
  onOpen,
  full = false,
}: {
  task: Task;
  goal: Goal | null;
  today: string;
  onOpen: (task: Task) => void;
  full?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(task);
      }}
      title={`${task.title}${goal ? ` · ${goal.title}` : ""}`}
      className={cn(
        "w-full touch-manipulation text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        full && "flex items-center gap-1",
        isDragging && "opacity-30"
      )}
    >
      {full && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
      <ChipBody task={task} goal={goal} today={today} full={full} />
    </button>
  );
}

function UnscheduledTray({
  tasks,
  goalOf,
  onOpenTask,
  today,
}: {
  tasks: Task[];
  goalOf: (t: Task) => Goal | null;
  onOpenTask: (task: Task) => void;
  today: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED });
  return (
    <aside
      ref={setNodeRef}
      aria-label="Unscheduled tasks"
      className={cn(
        "rounded-xl border p-3 transition-colors lg:sticky lg:top-0 lg:max-h-[70vh] lg:overflow-y-auto",
        isOver && "border-primary bg-primary/10"
      )}
    >
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <CalendarOff className="h-4 w-4 text-muted-foreground" /> Unscheduled
        <span className="text-xs font-normal text-muted-foreground">· {tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Nothing waiting. Drop a task here to take it off the calendar.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <TaskChip key={t.id} task={t} goal={goalOf(t)} today={today} onOpen={onOpenTask} full />
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">
            Drag onto a day, or tap a task to give it a date.
          </p>
        </div>
      )}
    </aside>
  );
}
