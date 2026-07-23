"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star,
  MoreVertical,
  Pencil,
  Copy,
  Eye,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Lock,
  Check,
  Plus,
  X,
  CornerDownRight,
  CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { NumberField } from "@/components/ui/number-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalBadges } from "@/components/goals/goal-badges";
import {
  goalMomentum,
  goalProgressDetail,
  goalStale,
  makeSubtask,
  type MomentumInfo,
  type NextAction,
} from "@/lib/goals";
import { cn } from "@/lib/utils";
import type { Goal, GoalSubtask } from "@/lib/types";

const MOMENTUM_STYLE: Record<MomentumInfo["tone"], { dot: string; text: string }> = {
  good: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  ok: { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  warn: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  none: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

export function MomentumChip({ m }: { m: MomentumInfo }) {
  if (m.label === "New")
    return <span className="text-xs text-muted-foreground/60">New — no history yet</span>;
  const s = MOMENTUM_STYLE[m.tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {m.label}
      {m.velocityPerWeek > 0 ? (
        <span className="font-normal text-muted-foreground">· +{m.velocityPerWeek}%/wk</span>
      ) : m.daysSinceGain != null && m.daysSinceGain > 0 ? (
        <span className="font-normal text-muted-foreground">· idle {m.daysSinceGain}d</span>
      ) : null}
    </span>
  );
}

export interface GoalCardProps {
  goal: Goal;
  prominent: boolean;
  today: string;
  blockers: Goal[];
  nextAction: NextAction | null;
  onToggleFocus: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
  onPeek: (goal: Goal) => void;
  onQuickPercent: (goal: Goal, v: number) => void;
  onQuickCount: (goal: Goal, v: number) => void;
  onSubtasksChange: (goal: Goal, subtasks: GoalSubtask[]) => void;
}

export function GoalCard({
  goal,
  prominent,
  today,
  blockers,
  nextAction,
  onToggleFocus,
  onEdit,
  onDelete,
  onDuplicate,
  onPeek,
  onQuickPercent,
  onQuickCount,
  onSubtasksChange,
}: GoalCardProps) {
  const [draft, setDraft] = useState("");
  const momentum = goalMomentum(goal, today);
  const doneSub = goal.subtasks.filter((s) => s.done).length;

  const toggleSub = (id: string) =>
    onSubtasksChange(
      goal,
      goal.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  const removeSub = (id: string) =>
    onSubtasksChange(
      goal,
      goal.subtasks.filter((s) => s.id !== id)
    );
  const addSub = () => {
    const t = draft.trim();
    if (!t) return;
    onSubtasksChange(goal, [...goal.subtasks, makeSubtask(t)]);
    setDraft("");
  };

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden",
        prominent && "ring-1 ring-primary/20"
      )}
      style={
        !goal.image && goal.color ? { borderLeft: `3px solid ${goal.color}` } : undefined
      }
    >
      {goal.image && (
        <div className="h-24 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={goal.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFocus(goal)}
              aria-label={goal.focus ? "Remove from focus" : "Add to focus"}
              aria-pressed={goal.focus}
              className={cn(
                "shrink-0 transition-colors",
                goal.focus
                  ? "text-amber-400 hover:text-amber-500"
                  : "text-muted-foreground/40 hover:text-amber-400"
              )}
            >
              <Star className={cn("h-4 w-4", goal.focus && "fill-current")} />
            </button>
            <Link
              href={`/goals/${goal.id}`}
              className="flex min-w-0 items-center gap-2 font-semibold hover:underline"
            >
              {goal.icon && <span aria-hidden>{goal.icon}</span>}
              <span className="truncate">{goal.title}</span>
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-1 h-8 w-8 shrink-0"
                aria-label="Goal actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleFocus(goal)}>
                <Star className={cn("h-4 w-4", goal.focus && "fill-current text-amber-400")} />
                {goal.focus ? "Unfocus" : "Focus"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPeek(goal)}>
                <Eye className="h-4 w-4" /> Quick look
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(goal)}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(goal)}>
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(goal)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <GoalBadges goal={goal} />
          {goalStale(goal, today) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> Needs attention
            </span>
          )}
          {blockers.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-300"
              title={`Blocked by: ${blockers.map((b) => b.title).join(", ")}`}
            >
              <Lock className="h-3 w-3" /> Blocked by {blockers[0].title}
              {blockers.length > 1 ? ` +${blockers.length - 1}` : ""}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="mt-auto space-y-3">
        {prominent && goal.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{goal.description}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{goalProgressDetail(goal) ?? "Progress"}</span>
            <span className="font-medium text-foreground">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} />
        </div>

        <MomentumChip m={momentum} />

        {/* Subtasks — quick checklist (add inline, tick off) */}
        <div className="space-y-1">
          {goal.subtasks.length > 0 && (
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
              <span>Subtasks</span>
              <span>
                {doneSub}/{goal.subtasks.length}
              </span>
            </div>
          )}
          {goal.subtasks.map((s) => (
            <div key={s.id} className="group/st flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSub(s.id)}
                aria-label={s.done ? "Mark not done" : "Mark done"}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  s.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-primary"
                )}
              >
                {s.done && <Check className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  "flex-1 truncate text-sm",
                  s.done && "text-muted-foreground line-through"
                )}
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => removeSub(s.id)}
                aria-label="Delete subtask"
                className="opacity-0 transition-opacity hover:text-destructive group-hover/st:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
              onBlur={addSub}
              placeholder="Add subtask"
              aria-label="Add subtask"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Next action (skip when it's just the next subtask — already shown above) */}
        {nextAction && nextAction.kind !== "subtask" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              <span className="text-muted-foreground/70">Next:</span>{" "}
              <span className="text-foreground/80">{nextAction.title}</span>
            </span>
          </p>
        ) : prominent && !nextAction && goal.subtasks.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <CircleDashed className="h-3.5 w-3.5 shrink-0" />
            Add a subtask, task, or milestone to see a next step.
          </p>
        ) : null}

        {/* Quick update by measurement type */}
        {goal.measurement === "percentage" ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Update</span>
            <NumberField
              value={goal.progress}
              onCommit={(v) => onQuickPercent(goal, v)}
              min={0}
              max={100}
              decimals={false}
              suffix="%"
              inputClassName="w-16"
              aria-label="Update progress percent"
            />
          </div>
        ) : goal.measurement === "count" ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Update</span>
            <NumberField
              value={goal.currentValue}
              onCommit={(v) => onQuickCount(goal, v)}
              min={0}
              inputClassName="w-16"
              aria-label="Update current value"
            />
            <span className="text-muted-foreground">
              / {goal.targetValue ?? 0}
              {goal.unit ? ` ${goal.unit}` : ""}
            </span>
          </div>
        ) : null}

        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link href={`/goals/${goal.id}`}>
            Open goal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
