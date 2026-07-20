"use client";

import { useCallback, useEffect, useState } from "react";
import { Shirt, Loader2, Settings2, Sparkles, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getDecisions } from "@/lib/firebase/db";
import { WEEKDAYS, weekdayKey, weekdayLabel } from "@/lib/decisions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionsFormDialog } from "@/components/decisions/decisions-form-dialog";
import { cn } from "@/lib/utils";
import type { DecisionConfig } from "@/lib/types";

export default function RoutinesPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<DecisionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setConfig(await getDecisions(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const todayKey = weekdayKey(new Date());
  const todayOutfit = config?.outfits?.[todayKey] ?? null;
  const defaults = config?.defaults ?? [];
  const hasAnything =
    Boolean(todayOutfit) ||
    defaults.length > 0 ||
    Object.keys(config?.outfits ?? {}).length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Routines</h1>
          <p className="text-muted-foreground">
            Pre-decide the recurring stuff — then just execute.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Settings2 className="h-4 w-4" /> Edit
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasAnything ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Eliminate daily decisions</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Every choice costs mental energy. Pre-decide your outfit for each
              day and your fixed defaults (bedtime, wake time, entertainment
              limit…). Then each morning you just follow the plan.
            </p>
            <Button onClick={() => setEditing(true)}>
              <Settings2 className="h-4 w-4" /> Set up routines
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Today */}
          <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Today · {weekdayLabel(todayKey)}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Shirt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {todayOutfit ?? "No outfit set for today"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Today&apos;s outfit — no thinking required.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fixed defaults */}
          {defaults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your defaults</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {defaults.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {d.label}
                    </span>
                    <span className="text-sm font-medium">{d.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Week outfits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outfits this week</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {WEEKDAYS.map((w) => {
                const outfit = config?.outfits?.[w.key];
                const isToday = w.key === todayKey;
                return (
                  <div
                    key={w.key}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "w-12 text-sm",
                        isToday
                          ? "font-semibold text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {w.short}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        !outfit && "text-muted-foreground/50"
                      )}
                    >
                      {outfit || "—"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {user && (
        <DecisionsFormDialog
          open={editing}
          onOpenChange={setEditing}
          userId={user.uid}
          config={config}
          onSaved={load}
        />
      )}
    </div>
  );
}
