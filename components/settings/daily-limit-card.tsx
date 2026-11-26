"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberField } from "@/components/ui/number-field";
import { useAuth } from "@/components/auth-provider";
import { getPrefs, upsertPrefs } from "@/lib/firebase/db";
import { DEFAULT_DAILY_LIMIT_MIN, minutesLabel } from "@/lib/planner";

/** Settings: the planner's "don't overload a day" limit. */
export function DailyLimitCard() {
  const { user } = useAuth();
  const [limit, setLimit] = useState(DEFAULT_DAILY_LIMIT_MIN);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (!user) return;
    getPrefs(user.uid)
      .then((p) => setLimit(p.dailyLimitMin))
      .catch(() => {
        /* keep the default */
      });
  }, [user]);

  async function save(v: number) {
    if (!user) return;
    const next = Math.min(1440, Math.max(15, Math.round(v)));
    setLimit(next);
    try {
      await upsertPrefs(user.uid, { dailyLimitMin: next });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Planner</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-medium">Daily limit</p>
          <p className="text-sm text-muted-foreground">
            Days with more estimated work than this ({minutesLabel(limit)}) are highlighted on
            Today and the calendar.
          </p>
          {status === "saved" && <p className="mt-1 text-xs text-emerald-500">Saved.</p>}
          {status === "error" && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              Couldn&apos;t save. Try again.
            </p>
          )}
        </div>
        <NumberField
          value={limit}
          onCommit={save}
          min={15}
          max={1440}
          decimals={false}
          suffix="min"
          inputClassName="w-20"
          aria-label="Daily limit in minutes"
        />
      </CardContent>
    </Card>
  );
}
