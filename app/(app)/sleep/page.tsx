"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getSleepLog,
  getSleepLogs,
  upsertSleepLog,
  deleteSleepLog,
  getPrefs,
  upsertPrefs,
} from "@/lib/firebase/db";
import { NumberField } from "@/components/ui/number-field";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import {
  hoursRating,
  qualityRating,
  formatHours,
  averageHours,
} from "@/lib/sleep";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SleepLog } from "@/lib/types";

export default function SleepPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDay = useCallback(
    async (d: string) => {
      if (!user) return;
      setLoading(true);
      try {
        const log = await getSleepLog(user.uid, d);
        setHours(log ? String(log.hours) : "");
        setQuality(log ? String(log.quality) : "");
        setNotes(log?.notes ?? "");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const [sleepTarget, setSleepTarget] = useState(8);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const [logs, prefs] = await Promise.all([
      getSleepLogs(user.uid),
      getPrefs(user.uid),
    ]);
    setHistory(logs);
    setSleepTarget(prefs.sleepTarget);
  }, [user]);

  async function changeSleepTarget(next: number) {
    if (!user) return;
    setSleepTarget(next);
    await upsertPrefs(user.uid, { sleepTarget: next });
  }

  useEffect(() => {
    loadDay(date);
    setSaved(false);
    setError(null);
  }, [loadDay, date]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const weekAvg = useMemo(() => {
    const cutoff = addDays(today, -6);
    const recent = history.filter((l) => l.date >= cutoff);
    return averageHours(recent);
  }, [history, today]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const h = Number(hours);
    const q = Number(quality);
    if (!hours || Number.isNaN(h) || h <= 0 || h > 24) {
      setError("Enter valid hours (0–24).");
      return;
    }
    if (!quality || Number.isNaN(q) || q < 1 || q > 10) {
      setError("Enter a quality from 1 to 10.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertSleepLog(user.uid, date, {
        hours: h,
        quality: Math.round(q),
        notes: notes.trim() || null,
      });
      setSaved(true);
      await loadHistory();
    } finally {
      setSaving(false);
    }
  }

  const isToday = date === today;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Sleep</h1>
          <p className="text-muted-foreground">
            {weekAvg > 0
              ? `You're averaging ${formatHours(weekAvg)} a night this week.`
              : "Log your sleep — it's the #1 driver of focus and study quality."}
          </p>
        </div>
        {/* Nightly goal — editable right where it's shown */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label className="text-sm text-muted-foreground">Nightly goal</Label>
          <NumberField
            value={sleepTarget}
            onCommit={changeSleepTarget}
            min={4}
            max={12}
            suffix="h"
            aria-label="Nightly sleep goal"
          />
        </div>
      </div>

      {/* Day nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDate((d) => addDays(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{formatLongDate(date)}</p>
          {isToday ? (
            <Badge variant="default" className="mt-1">
              Today
            </Badge>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setDate(today)}
            >
              Jump to today
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => setDate((d) => addDays(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Log form */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours slept</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.5"
                    min={0}
                    max={24}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 7.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quality">Quality (1–10)</Label>
                  <Input
                    id="quality"
                    type="number"
                    min={1}
                    max={10}
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Woke up once, went to bed late…"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    Saved ✓
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Recent nights
        </h2>
        {history.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Moon className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No sleep logged yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {history.slice(0, 30).map((log) => {
                const hr = hoursRating(log.hours, sleepTarget);
                const qr = qualityRating(log.quality);
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setDate(log.date)}
                    >
                      <p className="text-sm font-medium">
                        {formatLongDate(log.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHours(log.hours)} · quality {log.quality}/10
                      </p>
                    </button>
                    <Badge variant={hr.variant}>{hr.label}</Badge>
                    <Badge variant={qr.variant}>{qr.label}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      aria-label="Delete entry"
                      onClick={async () => {
                        if (!user) return;
                        await deleteSleepLog(user.uid, log.date);
                        if (log.date === date) {
                          setHours("");
                          setQuality("");
                          setNotes("");
                        }
                        await loadHistory();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
