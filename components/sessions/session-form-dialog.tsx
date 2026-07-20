"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSession,
  updateSession,
  type SessionInput,
} from "@/lib/firebase/db";
import {
  SESSION_CATEGORIES,
  SESSION_CATEGORY_LABEL,
  timeToMin,
  minToTime,
  computeSessionDefaults,
} from "@/lib/sessions";
import type {
  Goal,
  Session,
  SessionCategory,
  SessionStatus,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Date preselected for new sessions (YYYY-MM-DD). */
  defaultDate: string;
  goals: Goal[];
  /** The user's existing sessions, used to learn smart default times. */
  sessions?: Session[];
  session?: Session | null;
  onSaved: () => void;
}

const NO_GOAL = "__none__";

export function SessionFormDialog({
  open,
  onOpenChange,
  userId,
  defaultDate,
  goals,
  sessions = [],
  session,
  onSaved,
}: Props) {
  const isEdit = Boolean(session);
  const defaults = useMemo(
    () => computeSessionDefaults(sessions),
    [sessions]
  );

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SessionCategory>("study");
  const [goalId, setGoalId] = useState<string>(NO_GOAL);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("09:00");
  const [status, setStatus] = useState<SessionStatus>("planned");
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (session) {
      // Editing: use the session's own values.
      setTitle(session.title);
      setCategory(session.category);
      setGoalId(session.goalId ?? NO_GOAL);
      setDate(session.date);
      setStart(minToTime(session.startMin));
      setEnd(minToTime(session.endMin));
      setStatus(session.status);
      setQuality(session.quality != null ? String(session.quality) : "");
      setNotes(session.notes ?? "");
      setPrefilled(false);
    } else {
      // New: pre-fill category + times from the user's usual patterns.
      const cat = defaults.category ?? "study";
      const block = defaults.byCategory[cat];
      setTitle("");
      setCategory(cat);
      setGoalId(NO_GOAL);
      setDate(defaultDate);
      setStart(block ? minToTime(block.startMin) : "07:00");
      setEnd(block ? minToTime(block.endMin) : "09:00");
      setStatus("planned");
      setQuality("");
      setNotes("");
      setPrefilled(Boolean(block));
    }
    setError(null);
  }, [open, session, defaultDate, defaults]);

  // Switching category (when creating) snaps times to that category's usual block.
  function handleCategoryChange(v: SessionCategory) {
    setCategory(v);
    if (!isEdit) {
      const block = defaults.byCategory[v];
      if (block) {
        setStart(minToTime(block.startMin));
        setEnd(minToTime(block.endMin));
        setPrefilled(true);
      }
    }
  }

  // Typing a title you've used before pulls in its usual category + time.
  function handleTitleBlur() {
    if (isEdit) return;
    const match = defaults.byTitle[title.trim().toLowerCase()];
    if (match) {
      setCategory(match.category);
      setStart(minToTime(match.startMin));
      setEnd(minToTime(match.endMin));
      setPrefilled(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the session a title.");
      return;
    }
    const startMin = timeToMin(start);
    const endMin = timeToMin(end);
    if (startMin == null || endMin == null) {
      setError("Enter valid start and end times.");
      return;
    }
    if (endMin <= startMin) {
      setError("End time must be after start time.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }

    const parsedQuality =
      quality.trim() === "" ? null : Math.max(1, Math.min(10, Number(quality)));

    setSaving(true);
    setError(null);
    const payload: SessionInput = {
      title: title.trim(),
      category,
      goalId: goalId === NO_GOAL ? null : goalId,
      date,
      startMin,
      endMin,
      status,
      quality:
        status === "done" && parsedQuality != null && !Number.isNaN(parsedQuality)
          ? parsedQuality
          : null,
      notes: notes.trim() || null,
      color: session?.color ?? null,
    };

    try {
      if (isEdit && session) {
        await updateSession(session.id, payload);
      } else {
        await createSession(userId, payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit session" : "New session"}</DialogTitle>
          <DialogDescription>
            A timed block — study, workout, deep work — on your schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-title">Title</Label>
            <Input
              id="s-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="e.g. Spanish study"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => handleCategoryChange(v as SessionCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SESSION_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Linked goal</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GOAL}>None</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-date">Date</Label>
              <Input
                id="s-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-start">Start</Label>
              <Input
                id="s-start"
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPrefilled(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-end">End</Label>
              <Input
                id="s-end"
                type="time"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPrefilled(false);
                }}
              />
            </div>
          </div>
          {prefilled && !isEdit && (
            <p className="-mt-2 text-xs text-muted-foreground">
              ✨ Prefilled from your usual{" "}
              {SESSION_CATEGORY_LABEL[category].toLowerCase()} time — edit if
              needed.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as SessionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === "done" && (
              <div className="space-y-2">
                <Label htmlFor="s-quality">Quality (1–10)</Label>
                <Input
                  id="s-quality"
                  type="number"
                  min={1}
                  max={10}
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  placeholder="How did it go?"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-notes">Notes</Label>
            <Textarea
              id="s-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — what you covered, how it felt…"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
