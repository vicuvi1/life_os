"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSleepLogs, getNutritionLogs, getSessions } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { lastNDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import {
  buildDailyDataset,
  computeFactors,
  topInsight,
  rateDay,
  explainDay,
  type FactorResult,
} from "@/lib/dependencies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NutritionLog, Session, SleepLog } from "@/lib/types";

const RATING_VARIANT: Record<string, "success" | "default" | "warning" | "destructive"> =
  {
    Great: "success",
    Good: "default",
    Mixed: "warning",
    Rough: "destructive",
  };

function FactorCard({ f }: { f: FactorResult }) {
  // Only present a comparison when there's enough evidence on both sides.
  const hasData =
    f.hasEnough && f.delta != null && f.avgWith != null && f.avgWithout != null;
  const positive = (f.delta ?? 0) >= 0;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{f.label}</p>
          {hasData && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold",
                positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {positive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {positive ? "+" : ""}
              {(f.delta as number).toFixed(1)}
            </span>
          )}
        </div>

        {hasData ? (
          <>
            <p className="text-xs text-muted-foreground">
              Study quality {(f.avgWith as number).toFixed(1)} when you did vs{" "}
              {(f.avgWithout as number).toFixed(1)} when you didn&apos;t
            </p>
            <p className="text-xs text-muted-foreground/70">
              Based on {f.nWith} + {f.nWithout} tracked days
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Need more days logged on both sides to compare
            {f.nWith + f.nWithout > 0
              ? ` (${f.nWith + f.nWithout} so far)`
              : ""}
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DependenciesPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sl, nu, se] = await Promise.all([
        getSleepLogs(user.uid),
        getNutritionLogs(user.uid),
        getSessions(user.uid),
      ]);
      setSleep(sl);
      setNutrition(nu);
      setSessions(se);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const { factors, insight, recentDays, outcomeCount } = useMemo(() => {
    const dates = lastNDays(today, 60); // ascending
    const ds = buildDailyDataset(dates, sleep, nutrition, sessions);
    const fs = computeFactors(ds);
    const ins = topInsight(fs);
    // Recent days that have at least one signal, newest first.
    const recent = [...ds]
      .filter(
        (d) =>
          d.sleepHours != null ||
          d.water != null ||
          d.breakfast != null ||
          d.sessionQuality != null
      )
      .reverse()
      .slice(0, 14);
    const outcome = ds.filter((d) => d.sessionQuality != null).length;
    return {
      factors: fs,
      insight: ins,
      recentDays: recent,
      outcomeCount: outcome,
    };
  }, [sleep, nutrition, sessions, today]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Dependencies</h1>
        <p className="text-muted-foreground">
          How sleep, hydration, and food affect your study quality.
        </p>
      </div>

      {/* Top insight */}
      {insight && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Biggest lever right now</p>
              <p className="text-sm text-muted-foreground">
                On days you <strong>{insight.phrase}</strong>, your study
                quality averages{" "}
                <strong className="text-foreground">
                  {(insight.delta as number).toFixed(1)} points higher
                </strong>{" "}
                ({(insight.avgWith as number).toFixed(1)} vs{" "}
                {(insight.avgWithout as number).toFixed(1)}). Protect this habit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not-enough-data hint */}
      {outcomeCount < 3 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Activity className="h-7 w-7 text-muted-foreground" />
            <p className="font-medium">Keep logging to unlock correlations</p>
            <p className="max-w-md text-sm text-muted-foreground">
              This page compares your <strong>rated study sessions</strong>{" "}
              against your sleep, water, and meals. Log a few more days (mark
              sessions done with a quality score, plus sleep &amp; nutrition) and
              the patterns will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Factor comparison — only once there's a meaningful base of rated days,
          so it never renders alongside the "keep logging" hint. */}
      {outcomeCount >= 3 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            What moves your study quality
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {factors.map((f) => (
              <FactorCard key={f.key} f={f} />
            ))}
          </div>
        </section>
      )}

      {/* Recent days */}
      {recentDays.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Recent days
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {recentDays.map((d) => {
                const rating = rateDay(d);
                return (
                  <div key={d.date} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {formatLongDate(d.date)}
                      </span>
                      {rating && (
                        <Badge variant={RATING_VARIANT[rating.label]}>
                          {rating.label} · {rating.score}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {explainDay(d)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground/80">
                      {d.sleepHours != null && (
                        <span>💤 {d.sleepHours}h</span>
                      )}
                      {d.water != null && (
                        <span>
                          💧 {d.water}/{d.waterTarget ?? "?"}
                        </span>
                      )}
                      {d.breakfast != null && (
                        <span>🍳 {d.breakfast ? "yes" : "no"}</span>
                      )}
                      {d.sessionQuality != null && (
                        <span>📊 {d.sessionQuality.toFixed(1)}/10</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
