"use client";

import { CalendarClock, Flag, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  GOAL_STATUS_LABEL,
  GOAL_STATUS_VARIANT,
  PRIORITY_LABEL,
} from "@/lib/labels";
import { categoryLabel, goalDeadline, type DeadlineTone } from "@/lib/goals";
import { cn } from "@/lib/utils";
import type { Goal, Priority } from "@/lib/types";

// Each badge family gets a distinct but harmonious treatment so the row is
// scannable at a glance: status = solid pill, priority = flag pill, category =
// muted tag, deadline = tone-coloured clock.
const PRIORITY_PILL: Record<Priority, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};

const DEADLINE_PILL: Record<DeadlineTone, string> = {
  none: "border-dashed border-border text-muted-foreground",
  far: "border-transparent bg-muted text-muted-foreground",
  soon: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-300",
  overdue: "border-transparent bg-rose-500/15 text-rose-600 dark:text-rose-300",
};

const pill =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";

export function GoalBadges({
  goal,
  showDeadline = true,
}: {
  goal: Goal;
  showDeadline?: boolean;
}) {
  const cat = categoryLabel(goal.category);
  const dl = goalDeadline(goal);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={GOAL_STATUS_VARIANT[goal.status]}>
        {GOAL_STATUS_LABEL[goal.status]}
      </Badge>
      <span className={cn(pill, PRIORITY_PILL[goal.priority])}>
        <Flag className="h-3 w-3" />
        {PRIORITY_LABEL[goal.priority]}
      </span>
      {cat && (
        <span className={cn(pill, "border-transparent bg-muted text-muted-foreground")}>
          <Tag className="h-3 w-3" />
          {cat}
        </span>
      )}
      {showDeadline && (
        <span className={cn(pill, DEADLINE_PILL[dl.tone])}>
          <CalendarClock className="h-3 w-3" />
          {dl.label}
        </span>
      )}
    </div>
  );
}
