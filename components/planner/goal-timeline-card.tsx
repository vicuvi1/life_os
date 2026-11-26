import { CalendarRange, Flag, Gauge, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { shortDate } from "@/lib/goals";
import { addDays } from "@/lib/habits";
import { startOfWeekKey } from "@/lib/dates";
import {
  estimateAccuracy,
  goalProjection,
  goalSpentMin,
  goalTaskStats,
  goalTimeline,
  minutesLabel,
  spentByDate,
  sumRange,
} from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { Goal, Session, Task } from "@/lib/types";

interface Props {
  goal: Goal;
  /** The goal's tasks. */
  tasks: Task[];
  sessions: Session[];
  today: string;
}

/**
 * The honest picture of a goal: when it started, how much of the available
 * time is gone versus how much of the work is done, the hours put in, how good
 * the estimates were, and when it will finish at this pace.
 */
export function GoalTimelineCard({ goal, tasks, sessions, today }: Props) {
  const tl = goalTimeline(goal, today);
  const stats = goalTaskStats(goal.id, tasks);
  const spent = goalSpentMin(goal.id, tasks, sessions);
  const byDate = spentByDate(tasks, sessions, goal.id);
  const weekMin = sumRange(byDate, startOfWeekKey(today), today);
  const monthMin = sumRange(byDate, today.slice(0, 8) + "01", today);
  const accuracy = estimateAccuracy(tasks);
  const projection = goalProjection(goal, tasks, today);
  const notStarted = tl.dayNumber === 0;
  // Behind the clock: clearly more of the time is gone than of the work.
  const lagging =
    tl.timePercent != null && stats.total > 0 && tl.timePercent - stats.percent >= 15;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            {notStarted ? "Starts" : "Started"} {shortDate(tl.start)}
            {goal.deadline && (
              <>
                <span className="font-normal text-muted-foreground">→</span>
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                {shortDate(goal.deadline)}
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {notStarted
              ? `Starts in ${Math.abs(tl.daysLeft != null && tl.totalDays != null ? tl.totalDays - tl.daysLeft - 1 : 0)} days`
              : tl.totalDays != null
                ? `Day ${Math.min(tl.dayNumber, tl.totalDays)} of ${tl.totalDays}`
                : `Day ${tl.dayNumber}`}
          </p>
        </div>

        {tl.timePercent != null && (
          <div className="space-y-2">
            <Bar label="Time used" percent={tl.timePercent} tone={lagging ? "warn" : "muted"} />
            <Bar
              label={stats.total > 0 ? `Tasks done · ${stats.done}/${stats.total}` : "Tasks done"}
              percent={stats.percent}
              tone="primary"
            />
            {lagging && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {tl.timePercent}% of the time is gone but {stats.percent}% of the tasks are done.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact icon={Timer} label="Time spent" value={minutesLabel(spent) || "0m"} />
          <Fact icon={Timer} label="This week" value={minutesLabel(weekMin) || "0m"} />
          <Fact icon={Timer} label="This month" value={minutesLabel(monthMin) || "0m"} />
          <Fact
            icon={Gauge}
            label="Estimate vs actual"
            value={accuracy ? `${Math.round(accuracy.ratio * 100)}%` : "—"}
            hint={
              accuracy
                ? accuracy.ratio > 1.1
                  ? `Tasks take ${Math.round((accuracy.ratio - 1) * 100)}% longer than you guess`
                  : accuracy.ratio < 0.9
                    ? `Tasks take ${Math.round((1 - accuracy.ratio) * 100)}% less than you guess`
                    : "Your estimates are about right"
                : "Time a few estimated tasks to see this"
            }
            tone={accuracy && accuracy.ratio > 1.25 ? "warn" : undefined}
          />
        </div>

        <p className="flex items-start gap-2 border-t pt-3 text-sm">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          {projection ? (
            <span>
              At this pace ({projection.tasksPerWeek} tasks a week) you finish around{" "}
              <strong>{shortDate(projection.date)}</strong>
              {projection.daysVsDeadline != null && (
                <span
                  className={cn(
                    projection.daysVsDeadline > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {" "}
                  ·{" "}
                  {projection.daysVsDeadline > 0
                    ? `${projection.daysVsDeadline} days after the deadline`
                    : projection.daysVsDeadline < 0
                      ? `${Math.abs(projection.daysVsDeadline)} days early`
                      : "right on the deadline"}
                </span>
              )}
              <span className="text-muted-foreground"> (estimate)</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {stats.total > 0 && stats.done === stats.total
                ? "Every task is done."
                : "Finish two tasks to see a projected finish date."}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function Bar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: "muted" | "warn" | "primary";
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "primary" && "bg-primary",
            tone === "muted" && "bg-muted-foreground/50",
            tone === "warn" && "bg-amber-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div title={hint}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
