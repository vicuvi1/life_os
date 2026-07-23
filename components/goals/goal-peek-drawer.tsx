"use client";

import Link from "next/link";
import { X, ArrowRight, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GoalBadges } from "@/components/goals/goal-badges";
import { MomentumChip } from "@/components/goals/goal-card";
import { goalMomentum, goalProgressDetail, sortMilestones } from "@/lib/goals";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { Goal } from "@/lib/types";

/** A slide-in panel to peek a goal's details without leaving the list. */
export function GoalPeekDrawer({
  goal,
  onClose,
  onEdit,
}: {
  goal: Goal | null;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
}) {
  if (!goal) return null;
  const today = toDateKey(new Date());
  const milestones = sortMilestones(goal.milestones);
  const doneSub = goal.subtasks.filter((s) => s.done).length;

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-drawer-in flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={goal.color ? { borderTop: `3px solid ${goal.color}` } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {goal.icon && <span aria-hidden>{goal.icon}</span>}
            <span className="min-w-0">{goal.title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <GoalBadges goal={goal} />
          </div>

          {goal.description && (
            <p className="text-sm text-muted-foreground">{goal.description}</p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{goalProgressDetail(goal) ?? "Progress"}</span>
              <span className="font-medium text-foreground">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} />
          </div>

          <MomentumChip m={goalMomentum(goal, today)} />

          {milestones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                Milestones · {milestones.filter((m) => m.done).length}/{milestones.length}
              </p>
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      m.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {m.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn("truncate", m.done && "text-muted-foreground line-through")}>
                    {m.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {goal.subtasks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                Subtasks · {doneSub}/{goal.subtasks.length}
              </p>
              {goal.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      s.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {s.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn("truncate", s.done && "text-muted-foreground line-through")}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex items-center gap-2 border-t p-4">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/goals/${goal.id}`}>
              Open goal <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onEdit(goal);
              onClose();
            }}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
