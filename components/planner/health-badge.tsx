import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalHealth } from "@/lib/planner";

/** "On track" / "Behind" pill for a goal, with the reason as a tooltip. */
export function HealthBadge({
  health,
  showReason = false,
  className,
}: {
  health: GoalHealth;
  /** Also print the reason inline (used where there's room, e.g. goal detail). */
  showReason?: boolean;
  className?: string;
}) {
  const behind = health.status === "behind";
  const Icon = behind ? AlertTriangle : CheckCircle2;
  return (
    <span
      title={health.reason ?? "No overdue tasks or missed milestones"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        behind
          ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {health.label}
      {showReason && health.reason && (
        <span className="font-normal opacity-80">· {health.reason}</span>
      )}
    </span>
  );
}
