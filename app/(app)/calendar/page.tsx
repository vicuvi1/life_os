"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getTasks } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  monthGrid,
  isInMonth,
  dayNum,
  formatMonthYear,
  formatLongDate,
  WEEKDAYS_SHORT,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITY_VARIANT, PRIORITY_LABEL } from "@/lib/labels";
import type { Task } from "@/lib/types";

export default function CalendarPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(today);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTasks(await getTasks(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Map due-date → tasks with a due date.
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const arr = map.get(t.dueDate) ?? [];
      arr.push(t);
      map.set(t.dueDate, arr);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const selectedTasks = tasksByDate.get(selected) ?? [];

  function prevMonth() {
    setMonth((m) => (m === 0 ? 11 : m - 1));
    if (month === 0) setYear((y) => y - 1);
  }
  function nextMonth() {
    setMonth((m) => (m === 11 ? 0 : m + 1));
    if (month === 11) setYear((y) => y + 1);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(today);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Calendar</h1>
          <p className="text-muted-foreground">Your tasks by due date.</p>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={prevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-medium">{formatMonthYear(year, month)}</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

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
                  const dayTasks = tasksByDate.get(key) ?? [];
                  const openCount = dayTasks.filter(
                    (t) => t.status !== "done"
                  ).length;
                  const isToday = key === today;
                  const isSelected = key === selected;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className={cn(
                        "flex min-h-[52px] flex-col items-center rounded-md border p-1 text-sm transition-colors sm:min-h-[64px]",
                        inMonth
                          ? "hover:border-primary/50"
                          : "text-muted-foreground/40",
                        isSelected && "border-primary bg-primary/5",
                        !isSelected && "border-transparent"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          isToday && "bg-primary font-semibold text-primary-foreground"
                        )}
                      >
                        {dayNum(key)}
                      </span>
                      {dayTasks.length > 0 && (
                        <span
                          className={cn(
                            "mt-1 rounded-full px-1.5 text-[10px] font-medium",
                            openCount > 0
                              ? "bg-primary/15 text-primary"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {openCount > 0 ? openCount : "✓"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day's tasks */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {formatLongDate(selected)}
            </h2>
            {selectedTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                  <CalendarDays className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No tasks due this day.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {selectedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "text-sm",
                          t.status === "done" &&
                            "text-muted-foreground line-through"
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
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
