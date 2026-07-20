"use client";

import Link from "next/link";
import { Moon, Flame, Target, CalendarClock, CheckSquare, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sessionColor, rangeLabel } from "@/lib/sessions";
import { PRIORITY_LABEL, PRIORITY_VARIANT, deadlineLabel } from "@/lib/labels";
import { hoursRating } from "@/lib/sleep";
import { cn } from "@/lib/utils";
import type { CalToggles, DayView } from "@/lib/calendar";

export function DayAgenda({
  day,
  toggles,
}: {
  day: DayView;
  toggles: CalToggles;
}) {
  const conflictsWithin = (() => {
    // Local overlap check within the day's own sessions (for the flag).
    const ids = new Set<string>();
    const s = day.sessions;
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++)
        if (s[i].startMin < s[j].endMin && s[j].startMin < s[i].endMin) {
          ids.add(s[i].id);
          ids.add(s[j].id);
        }
    return ids;
  })();

  const rows: React.ReactNode[] = [];

  if (toggles.goals && day.goalDeadlines.length > 0) {
    for (const g of day.goalDeadlines) {
      rows.push(
        <div key={`g-${g.id}`} className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 shrink-0 text-rose-500" />
          <span className="flex-1 truncate">{g.title}</span>
          <Badge variant="destructive">{deadlineLabel(g.deadline)}</Badge>
        </div>
      );
    }
  }

  if (toggles.sleep && day.sleep) {
    const hr = hoursRating(day.sleep.hours);
    rows.push(
      <div key="sleep" className="flex items-center gap-2 text-sm">
        <Moon className="h-4 w-4 shrink-0 text-indigo-400" />
        <span className="flex-1">
          Slept {day.sleep.hours}h · quality {day.sleep.quality}/10
        </span>
        <Badge variant={hr.variant}>{hr.label}</Badge>
      </div>
    );
  }

  if (toggles.sessions && day.sessions.length > 0) {
    for (const s of day.sessions) {
      rows.push(
        <div key={`s-${s.id}`} className="flex items-center gap-2 text-sm">
          <span
            className="h-4 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: sessionColor(s) }}
          />
          <span
            className={cn(
              "flex-1 truncate",
              s.status === "skipped" && "text-muted-foreground line-through"
            )}
          >
            {s.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {rangeLabel(s.startMin, s.endMin).split(" (")[0]}
          </span>
          {conflictsWithin.has(s.id) && (
            <span className="text-xs font-medium text-destructive">⚠</span>
          )}
        </div>
      );
    }
  }

  if (toggles.tasks && day.tasks.length > 0) {
    for (const t of day.tasks) {
      rows.push(
        <div key={`t-${t.id}`} className="flex items-center gap-2 text-sm">
          <CheckSquare
            className={cn(
              "h-4 w-4 shrink-0",
              t.status === "done" ? "text-emerald-500" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "flex-1 truncate",
              t.status === "done" && "text-muted-foreground line-through"
            )}
          >
            {t.title}
          </span>
          {t.status !== "done" && (
            <Badge variant={PRIORITY_VARIANT[t.priority]}>
              {PRIORITY_LABEL[t.priority]}
            </Badge>
          )}
        </div>
      );
    }
  }

  if (toggles.habits && day.habitsTotal > 0 && day.habitsDone > 0) {
    rows.push(
      <div key="habits" className="flex items-center gap-2 text-sm">
        <Flame className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="flex-1">Habits</span>
        <span className="text-xs text-muted-foreground">
          {day.habitsDone}/{day.habitsTotal} done
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CalendarClock className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium">Nothing scheduled</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Plan a session or add a task to make the most of this day.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/sessions">
            <Plus className="h-3.5 w-3.5" /> Add a session
          </Link>
        </Button>
      </div>
    );
  }

  return <div className="space-y-2">{rows}</div>;
}
