"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useMemo, useState } from "react";
import {
  Timer,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Clock,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSessions } from "@/lib/firebase/db";
import { useCachedResource } from "@/lib/use-cached-resource";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import {
  SESSION_CATEGORY_LABEL,
  SESSION_CATEGORY_COLOR,
} from "@/lib/sessions";
import {
  categoryTotals,
  totalDoneMinutes,
  focusByTimeOfDay,
  bestFocusBucket,
  weeklyStudyTrend,
} from "@/lib/timeaudit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

const RANGES = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
];

function fmtHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function TimeAuditPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [range, setRange] = useState(30);
  const { data: sessions = [], loading } = useCachedResource<Session[]>(
    user ? `sessions:${user.uid}` : null,
    async () => getSessions(user!.uid)
  );

  const fromDate = addDays(today, -(range - 1));

  const { cats, totalMin, focus, best, trend } = useMemo(() => {
    const cats = categoryTotals(sessions, fromDate, today);
    const totalMin = totalDoneMinutes(sessions, fromDate, today);
    const focus = focusByTimeOfDay(sessions, fromDate, today);
    const best = bestFocusBucket(focus);
    const trend = weeklyStudyTrend(sessions, today);
    return { cats, totalMin, focus, best, trend };
  }, [sessions, fromDate, today]);

  const maxCat = Math.max(1, ...cats.map((c) => c.minutes));
  const maxFocusMin = Math.max(1, ...focus.map((f) => f.minutes));

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const hasData = totalMin > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Time Audit</h1>
        <p className="text-muted-foreground">
          Where your time actually goes, and when you do your best work.
        </p>
      </div>

      {/* Range toggle */}
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={range === r.key ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
            <Timer className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No completed sessions in this range</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Mark sessions as done on the Sessions page and your time
              breakdown and best-focus hours will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Total */}
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold leading-tight">
                  {fmtHours(totalMin)}
                </p>
                <p className="text-sm text-muted-foreground">
                  tracked over the last {range} days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time by category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time by category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cats.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{SESSION_CATEGORY_LABEL[c.category]}</span>
                    <span className="text-muted-foreground">
                      {fmtHours(c.minutes)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((c.minutes / maxCat) * 100)}%`,
                        backgroundColor: SESSION_CATEGORY_COLOR[c.category],
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Best focus time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">When you focus best</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {best ? (
                <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm">
                    Your best focus is{" "}
                    <strong>{best.label}</strong> — average quality{" "}
                    <strong>{best.avgQuality!.toFixed(1)}/10</strong> across{" "}
                    {best.count} sessions. Schedule your hardest work then.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Rate a few more completed sessions (3+ in a time block) to see
                  your peak focus hours.
                </p>
              )}

              <div className="space-y-3">
                {focus.map((f) => {
                  const isBest = best?.key === f.key;
                  return (
                    <div key={f.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={cn(isBest && "font-medium text-primary")}>
                          {f.label}
                        </span>
                        <span className="text-muted-foreground">
                          {f.avgQuality != null
                            ? `${f.avgQuality.toFixed(1)}/10 · ${f.count} sessions`
                            : "—"}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isBest ? "bg-primary" : "bg-primary/40"
                          )}
                          style={{
                            width: `${Math.round((f.minutes / maxFocusMin) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Bars show time logged in each block; the number is average
                session quality.
              </p>
            </CardContent>
          </Card>

          {/* Weekly trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">This week vs last</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">
                  {fmtHours(trend.thisWeek)}
                </p>
                <p className="text-sm text-muted-foreground">
                  so far this week · {fmtHours(trend.lastWeekToDate)} by this
                  point last week
                </p>
              </div>
              {trend.deltaPct != null && (
                <Badge
                  variant={trend.deltaPct >= 0 ? "success" : "warning"}
                  className="text-sm"
                >
                  {trend.deltaPct >= 0 ? (
                    <TrendingUp className="mr-1 h-4 w-4" />
                  ) : (
                    <TrendingDown className="mr-1 h-4 w-4" />
                  )}
                  {trend.deltaPct >= 0 ? "+" : ""}
                  {trend.deltaPct}%
                </Badge>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
