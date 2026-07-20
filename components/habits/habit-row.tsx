"use client";

import { useState } from "react";
import { Flame, MoreVertical, Pencil, Trash2, Trophy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HABIT_CATEGORY_LABEL, type HabitState } from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/types";

interface Props {
  habit: Habit;
  state: HabitState;
  /** Today's logged value for count/duration habits. */
  todayValue?: number | null;
  onToggle: (done: boolean) => Promise<void> | void;
  /** Log an exact value for count/duration habits. */
  onSetValue?: (value: number) => Promise<void> | void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habit: Habit) => void;
  showWeek?: boolean;
}

export function HabitRow({
  habit,
  state,
  todayValue = null,
  onToggle,
  onSetValue,
  onEdit,
  onDelete,
  showWeek = true,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [popping, setPopping] = useState(false);
  const color = habit.color ?? "#8b5cf6";
  const isMeasured = (habit.targetType ?? "check") !== "check";

  async function toggle(checked: boolean) {
    setBusy(true);
    if (checked) {
      setPopping(true);
      setTimeout(() => setPopping(false), 260);
    }
    try {
      await onToggle(checked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn(popping && "animate-pop")}>
        <Checkbox
          checked={state.completedToday}
          disabled={busy}
          onCheckedChange={(c) => toggle(Boolean(c))}
          aria-label={
            state.completedToday ? "Mark not done today" : "Mark done today"
          }
          style={
            state.completedToday
              ? { backgroundColor: color, borderColor: color }
              : { borderColor: color }
          }
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{habit.title}</span>
          {habit.category && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {HABIT_CATEGORY_LABEL[habit.category]}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Flame
              className={cn(
                "h-3.5 w-3.5",
                state.streak > 0 ? "text-orange-500" : "opacity-40"
              )}
            />
            {state.streak}d streak
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5 opacity-60" />
            best {state.best}
          </span>
        </div>
      </div>

      {/* Count/duration habits: today's value is directly typeable. */}
      {isMeasured && onSetValue && (
        <span className="flex shrink-0 items-center gap-1">
          <NumberField
            value={todayValue ?? 0}
            onCommit={(v) => onSetValue(v)}
            min={0}
            decimals={habit.targetType === "duration"}
            aria-label={`Today's ${habit.title}`}
            inputClassName="w-12"
          />
          <span className="text-xs text-muted-foreground">
            / {habit.targetValue ?? 0}
            {habit.targetType === "duration" ? " min" : ""}
          </span>
        </span>
      )}

      {showWeek && (
        <div className="hidden items-center gap-1 sm:flex">
          {state.last7.map((done, i) => (
            <span
              key={i}
              className={cn(
                "h-4 w-4 rounded-[4px] border",
                !done && "bg-transparent"
              )}
              style={
                done
                  ? { backgroundColor: color, borderColor: color }
                  : undefined
              }
              title={done ? "Completed" : "Missed"}
            />
          ))}
        </div>
      )}

      {(onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Habit actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(habit)}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(habit)}
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
