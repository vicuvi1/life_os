"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWeeklyReview,
  getWeeklyReviews,
  upsertWeeklyReview,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { startOfWeekKey, formatWeekRange } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WeeklyReview } from "@/lib/types";

export default function ReviewPage() {
  const { user } = useAuth();
  const thisWeek = startOfWeekKey(toDateKey(new Date()));

  const [weekStart, setWeekStart] = useState(thisWeek);
  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState("");
  const [score, setScore] = useState("");
  const [history, setHistory] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadWeek = useCallback(
    async (ws: string) => {
      if (!user) return;
      setLoading(true);
      try {
        const review = await getWeeklyReview(user.uid, ws);
        setAccomplishments(review?.accomplishments ?? "");
        setBlockers(review?.blockers ?? "");
        setNextWeekFocus(review?.nextWeekFocus ?? "");
        setScore(review?.score != null ? String(review.score) : "");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistory(await getWeeklyReviews(user.uid));
  }, [user]);

  useEffect(() => {
    loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const parsedScore = score.trim() === "" ? null : Number(score);
      await upsertWeeklyReview(user.uid, weekStart, {
        accomplishments: accomplishments.trim() || null,
        blockers: blockers.trim() || null,
        nextWeekFocus: nextWeekFocus.trim() || null,
        score:
          parsedScore != null && !Number.isNaN(parsedScore)
            ? Math.max(0, Math.min(100, Math.round(parsedScore)))
            : null,
      });
      setSaved(true);
      await loadHistory();
    } finally {
      setSaving(false);
    }
  }

  const isCurrentWeek = weekStart === thisWeek;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Weekly Review</h1>
        <p className="text-muted-foreground">
          Reflect on wins, blockers, and next week&apos;s focus.
        </p>
      </div>

      {/* Week selector */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => {
            setSaved(false);
            setWeekStart((w) => addDays(w, -7));
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{formatWeekRange(weekStart)}</p>
          {isCurrentWeek && (
            <Badge variant="default" className="mt-1">
              This week
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          disabled={isCurrentWeek}
          onClick={() => {
            setSaved(false);
            setWeekStart((w) => addDays(w, 7));
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="acc">🎉 What went well?</Label>
                <Textarea
                  id="acc"
                  value={accomplishments}
                  onChange={(e) => setAccomplishments(e.target.value)}
                  placeholder="Wins, progress, things you're proud of…"
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blk">🚧 What got in the way?</Label>
                <Textarea
                  id="blk"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Blockers, distractions, what to fix…"
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nxt">🎯 Focus for next week</Label>
                <Textarea
                  id="nxt"
                  value={nextWeekFocus}
                  onChange={(e) => setNextWeekFocus(e.target.value)}
                  placeholder="Top priorities for the coming week…"
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score">Week score (0–100)</Label>
                <Input
                  id="score"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="How was the week overall?"
                  className="max-w-[160px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save review"}
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
          Past reviews
        </h2>
        {history.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <CalendarCheck className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No reviews yet. Your saved reviews will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSaved(false);
                  setWeekStart(r.weekStart);
                }}
                className="w-full text-left"
              >
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader className="flex-row items-center justify-between py-4">
                    <CardTitle className="text-sm font-medium">
                      {formatWeekRange(r.weekStart)}
                    </CardTitle>
                    {r.score != null && (
                      <Badge
                        variant={
                          r.score >= 70
                            ? "success"
                            : r.score >= 40
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {r.score}/100
                      </Badge>
                    )}
                  </CardHeader>
                </Card>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
