import type {
  GoalStatus,
  Priority,
  ProjectStatus,
  GoalCategory,
} from "@/lib/types";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const GOAL_STATUS_VARIANT: Record<GoalStatus, BadgeVariant> = {
  active: "default",
  paused: "warning",
  completed: "success",
  archived: "secondary",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_VARIANT: Record<Priority, BadgeVariant> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const PROJECT_STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  not_started: "secondary",
  in_progress: "default",
  completed: "success",
};

export const CATEGORY_LABEL: Record<GoalCategory, string> = {
  education: "Education",
  career: "Career",
  health: "Health",
  financial: "Financial",
  personal: "Personal",
};

export const GOAL_STATUSES: GoalStatus[] = [
  "active",
  "paused",
  "completed",
  "archived",
];
export const PRIORITIES: Priority[] = ["high", "medium", "low"];
export const PROJECT_STATUSES: ProjectStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];
export const CATEGORIES: GoalCategory[] = [
  "education",
  "career",
  "health",
  "financial",
  "personal",
];

/** Days until a deadline (negative if past). null if no deadline. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** Human label for a deadline relative to today. */
export function deadlineLabel(dateStr: string | null): string | null {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  return `${d}d left`;
}
