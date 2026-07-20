"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getGoals,
  getSessions,
  deleteSession,
  updateSession,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import { formatLongDate } from "@/lib/dates";
import { findConflicts, totalMinutes } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionRow } from "@/components/sessions/session-row";
import { SessionFormDialog } from "@/components/sessions/session-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Goal, Session } from "@/lib/types";

export default function SessionsPage() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const [date, setDate] = useState(today);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<{ open: boolean; session: Session | null }>({
    open: false,
    session: null,
  });
  const [deleting, setDeleting] = useState<Session | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, g] = await Promise.all([getSessions(user.uid), getGoals(user.uid)]);
      setSessions(s);
      setGoals(g);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const daySessions = useMemo(
    () => sessions.filter((s) => s.date === date),
    [sessions, date]
  );
  const conflicts = useMemo(() => findConflicts(daySessions), [daySessions]);

  const goalTitle = useMemo(() => {
    const m = new Map(goals.map((g) => [g.id, g.title]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [goals]);

  const plannedMin = totalMinutes(daySessions.filter((s) => s.status !== "skipped"));
  const doneMin = totalMinutes(daySessions.filter((s) => s.status === "done"));

  async function markDone(s: Session) {
    await updateSession(s.id, { status: "done" });
    // Reopen in edit mode so a quality rating can be added right away.
    setForm({ open: true, session: { ...s, status: "done" } });
    await load();
  }

  async function markSkipped(s: Session) {
    await updateSession(s.id, { status: "skipped" });
    await load();
  }

  function fmtHours(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Sessions</h1>
          <p className="text-muted-foreground">
            Timed blocks for study, workouts, and deep work.
          </p>
        </div>
        {user && (
          <Button onClick={() => setForm({ open: true, session: null })}>
            <Plus className="h-4 w-4" /> New session
          </Button>
        )}
      </div>

      {/* Day navigation */}
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
          {date === today ? (
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
          onClick={() => setDate((d) => addDays(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day stats */}
      {daySessions.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{fmtHours(plannedMin)} planned</Badge>
          <Badge variant="success">{fmtHours(doneMin)} done</Badge>
          {conflicts.size > 0 && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {conflicts.size} overlapping
            </Badge>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : daySessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No sessions this day</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Plan your day in timed blocks — Spanish 7–9am, gym at 4pm — and
              rate the quality afterward.
            </p>
            <Button onClick={() => setForm({ open: true, session: null })}>
              <Plus className="h-4 w-4" /> Add a session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {daySessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                conflicted={conflicts.has(s.id)}
                goalTitle={goalTitle(s.goalId)}
                onEdit={(sess) => setForm({ open: true, session: sess })}
                onDelete={setDeleting}
                onMarkDone={markDone}
                onMarkSkipped={markSkipped}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {user && (
        <SessionFormDialog
          open={form.open}
          onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
          userId={user.uid}
          defaultDate={date}
          goals={goals}
          sessions={sessions}
          session={form.session}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this session?"
        onConfirm={async () => {
          if (deleting) {
            await deleteSession(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
