"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/goals";
import { goalStartDate, isDateKey, yearBar, yearPercent, type GoalHealth } from "@/lib/planner";
import type { Goal } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FALLBACK = "hsl(var(--muted-foreground))";

interface Props {
  year: number;
  goals: Goal[];
  today: string;
  healthById: Map<string, GoalHealth>;
}

/**
 * Twelve months across, one bar per goal from its start date to its deadline,
 * milestones as dots and a line for today — overlaps and empty months show at
 * a glance. Scrolls sideways on narrow screens.
 */
export function YearRoadmap({ year, goals, today, healthById }: Props) {
  const todayPct = today.slice(0, 4) === String(year) ? yearPercent(today, year) : null;
  const rows = goals
    .map((goal) => {
      const start = goalStartDate(goal, today);
      const hasDeadline = isDateKey(goal.deadline);
      // No deadline: draw up to today (or the start, if that's later) and fade out.
      const end = hasDeadline ? (goal.deadline as string) : today > start ? today : start;
      return { goal, start, end, hasDeadline, bar: yearBar(start, end, year) };
    })
    .filter((r) => r.bar != null)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  // On narrow screens the year is wider than the viewport: open on today.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || todayPct == null || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, (todayPct / 100) * el.scrollWidth - el.clientWidth * 0.6);
  }, [todayPct, rows.length]);

  return (
    <div ref={scroller} className="overflow-x-auto rounded-xl border">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-12 border-b text-center text-xs font-medium text-muted-foreground">
          {MONTHS.map((m, i) => (
            <div key={m} className={cn("py-2", i > 0 && "border-l border-border/50")}>
              {m}
            </div>
          ))}
        </div>

        <div className="relative">
          {/* Month gridlines + today line behind the rows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-12">
            {MONTHS.map((m, i) => (
              <div key={m} className={cn(i > 0 && "border-l border-border/40")} />
            ))}
          </div>
          {todayPct != null && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
              style={{ left: `${todayPct}%` }}
            />
          )}

          {rows.length === 0 ? (
            <p className="relative p-8 text-center text-sm text-muted-foreground">
              No goals are active in {year}.
            </p>
          ) : (
            <ul className="relative space-y-4 py-3 pb-4">
              {rows.map(({ goal, start, end, hasDeadline, bar }) => {
                if (!bar) return null;
                const color = goal.color ?? FALLBACK;
                const health = healthById.get(goal.id);
                const finished = goal.status === "completed";
                const parked = goal.status === "paused";
                return (
                  <li key={goal.id}>
                    <div className="relative h-9">
                      <Link
                        href={`/goals/${goal.id}`}
                        title={`${goal.title}: ${shortDate(start)} → ${
                          hasDeadline ? shortDate(end) : "no deadline"
                        }`}
                        className={cn(
                          "absolute inset-y-0 flex items-center overflow-hidden rounded-md border px-2 text-xs font-medium text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          bar.clippedStart && "rounded-l-none border-l-0",
                          (bar.clippedEnd || !hasDeadline) && "rounded-r-none border-r-0",
                          parked && "opacity-50",
                          finished && "opacity-60"
                        )}
                        style={{
                          left: `${bar.left}%`,
                          width: `${bar.width}%`,
                          borderColor: color,
                          background: hasDeadline
                            ? `color-mix(in srgb, ${color} 22%, transparent)`
                            : `linear-gradient(to right, color-mix(in srgb, ${color} 22%, transparent), transparent)`,
                        }}
                      >
                        {/* Progress fill */}
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${goal.progress}%`,
                            background: `color-mix(in srgb, ${color} 35%, transparent)`,
                          }}
                        />
                        <span className="relative truncate">
                          {goal.icon ? `${goal.icon} ` : ""}
                          {goal.title}
                          {health?.status === "behind" && !finished && !parked && (
                            <span className="ml-1.5 text-rose-500">· behind</span>
                          )}
                          {parked && <span className="ml-1.5 text-muted-foreground">· parked</span>}
                        </span>
                      </Link>
                      {/* Milestones */}
                      {goal.milestones.map((m) => {
                        if (!isDateKey(m.dueDate) || m.dueDate.slice(0, 4) !== String(year)) return null;
                        return (
                          <span
                            key={m.id}
                            title={`${m.title} · ${shortDate(m.dueDate)}${m.done ? " · done" : ""}`}
                            className={cn(
                              "absolute top-full z-[5] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2",
                              m.done ? "bg-background" : ""
                            )}
                            style={{
                              left: `${yearPercent(m.dueDate, year) + 0.14}%`,
                              borderColor: color,
                              backgroundColor: m.done ? undefined : color,
                            }}
                          />
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
