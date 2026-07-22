"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getSessions,
  getTasks,
  getDailyHabits,
  getHabitLogs,
  getSleepLogs,
  getGoals,
} from "@/lib/firebase/db";
import { useCachedResource } from "@/lib/use-cached-resource";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import {
  monthGrid,
  isInMonth,
  dayNum,
  formatMonthYear,
  formatLongDate,
  formatWeekRange,
  startOfWeekKey,
  WEEKDAYS_SHORT,
} from "@/lib/dates";
import {
  buildCalData,
  dayView,
  dayHasContent,
  CAL_ELEMENTS,
  DEFAULT_TOGGLES,
  type CalToggles,
  type CalElement,
} from "@/lib/calendar";
import { sessionColor } from "@/lib/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DayAgenda } from "@/components/calendar/day-agenda";
import { cn } from "@/lib/utils";
import type { Goal, Habit, HabitLog, Session, SleepLog, Task } from "@/lib/types";

const TOGGLES_KEY = "lifeos:calendar:toggles";
type ViewMode = "month" | "week";

export default function CalendarPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(today); // focus date
  const [selected, setSelected] = useState(today);
  const [toggles, setToggles] = useState<CalToggles>(DEFAULT_TOGGLES);

  const { data: calData, loading } = useCachedResource(
    user ? `calendar:${user.uid}` : null,
    async () => {
      const [se, t, h, hl, sl, g] = await Promise.all([
        getSessions(user!.uid),
        getTasks(user!.uid),
        getDailyHabits(user!.uid),
        getHabitLogs(user!.uid),
        getSleepLogs(user!.uid),
        getGoals(user!.uid),
      ]);
      return { sessions: se, tasks: t, dailyHabits: h, habitLogs: hl, sleep: sl, goals: g };
    }
  );
  const sessions = useMemo(() => calData?.sessions ?? [], [calData]);
  const tasks = useMemo(() => calData?.tasks ?? [], [calData]);
  const dailyHabits = useMemo(() => calData?.dailyHabits ?? [], [calData]);
  const habitLogs = useMemo(() => calData?.habitLogs ?? [], [calData]);
  const sleep = useMemo(() => calData?.sleep ?? [], [calData]);
  const goals = useMemo(() => calData?.goals ?? [], [calData]);

  // Restore toggle preferences.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOGGLES_KEY);
      if (raw) setToggles({ ...DEFAULT_TOGGLES, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(key: CalElement) {
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(TOGGLES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const data = useMemo(
    () =>
      buildCalData({
        sessions,
        tasks,
        dailyHabits,
        habitLogs,
        sleep,
        goals,
      }),
    [sessions, tasks, dailyHabits, habitLogs, sleep, goals]
  );

  const cursorDate = new Date(cursor + "T00:00:00");
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const weekStart = startOfWeekKey(cursor);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function navigate(dir: -1 | 1) {
    if (view === "month") {
      const d = new Date(year, month + dir, 1);
      setCursor(toDateKey(d));
    } else {
      setCursor(addDays(weekStart, dir * 7));
    }
  }

  function goToday() {
    setCursor(today);
    setSelected(today);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Calendar</h1>
          <p className="text-muted-foreground">
            Your whole life in one view.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {(["month", "week"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-1.5">
        {CAL_ELEMENTS.map((el) => (
          <button
            key={el.key}
            onClick={() => toggle(el.key)}
            aria-pressed={toggles[el.key]}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              toggles[el.key]
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {el.label}
          </button>
        ))}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Previous" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">
          {view === "month"
            ? formatMonthYear(year, month)
            : formatWeekRange(weekStart)}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : view === "month" ? (
        <>
          <Card>
            <CardContent className="p-2 sm:p-4">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {grid.flat().map((key) => {
                  const inMonth = isInMonth(key, year, month);
                  const dv = dayView(data, key);
                  const isToday = key === today;
                  const isSelected = key === selected;
                  const openTasks = toggles.tasks
                    ? dv.tasks.filter((t) => t.status !== "done").length
                    : 0;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className={cn(
                        "flex min-h-[54px] flex-col items-center gap-1 rounded-md border p-1 text-sm transition-colors sm:min-h-[68px]",
                        inMonth
                          ? "hover:border-primary/50"
                          : "text-muted-foreground/40",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          isToday &&
                            "bg-primary font-semibold text-primary-foreground"
                        )}
                      >
                        {dayNum(key)}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-0.5">
                        {toggles.goals &&
                          dv.goalDeadlines.length > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          )}
                        {toggles.sleep && dv.sleep && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        )}
                        {toggles.habits && dv.habitsDone > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        )}
                        {toggles.sessions &&
                          dv.sessions.slice(0, 3).map((s) => (
                            <span
                              key={s.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: sessionColor(s) }}
                            />
                          ))}
                        {openTasks > 0 && (
                          <span className="rounded-full bg-primary/15 px-1 text-[10px] font-medium text-primary">
                            {openTasks}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day detail */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {formatLongDate(selected)}
            </h2>
            <Card>
              <CardContent className="p-4">
                <DayAgenda day={dayView(data, selected)} toggles={toggles} />
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        // Week view — an agenda card per day.
        <div className="space-y-3">
          {weekDates.map((key) => {
            const dv = dayView(data, key);
            const isToday = key === today;
            return (
              <Card
                key={key}
                className={cn(isToday && "border-primary/50")}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isToday && "text-primary"
                      )}
                    >
                      {formatLongDate(key)}
                    </span>
                    {isToday && <Badge variant="default">Today</Badge>}
                  </div>
                  {dayHasContent(dv, toggles) ? (
                    <DayAgenda day={dv} toggles={toggles} />
                  ) : (
                    <p className="text-sm text-muted-foreground/60">—</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
