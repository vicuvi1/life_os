"use client";

import { useEffect, useState } from "react";
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
import { toggleHabitLog, setHabitLogValue, setHabitLogNote } from "@/lib/firebase/db";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  habit: Habit | null;
  date: string | null;
  log: HabitLog | null;
  onSaved: () => void;
}

function prettyDate(key: string | null): string {
  if (!key) return "";
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function DayEditorDialog({ open, onOpenChange, userId, habit, date, log, onSaved }: Props) {
  const isCount = habit ? (habit.targetType ?? "check") !== "check" : false;
  const [done, setDone] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(Boolean(log));
    setValue(log?.value != null ? String(log.value) : "");
    setNote(log?.note ?? "");
  }, [open, log]);

  async function save() {
    if (!habit || !date) return;
    setSaving(true);
    try {
      let kept: boolean;
      if (isCount) {
        const v = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
        kept = v > 0;
        if (kept) await setHabitLogValue(userId, habit.id, date, v);
        else await toggleHabitLog(userId, habit.id, date, false);
      } else {
        kept = done;
        await toggleHabitLog(userId, habit.id, date, done, null);
      }
      if (kept) await setHabitLogNote(userId, habit.id, date, note.trim() || null);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const target = habit?.targetValue ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{habit?.emoji || "📝"}</span>
            {habit?.title ?? "Day"}
          </DialogTitle>
          <DialogDescription>{prettyDate(date)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCount ? (
            <div className="space-y-2">
              <Label htmlFor="d-value">
                Amount{habit?.targetType === "duration" ? " (minutes)" : ""}{target != null ? ` · target ${target}` : ""}
              </Label>
              <Input
                id="d-value"
                type="number"
                min={0}
                step="0.5"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              {[
                { key: true, label: "Done" },
                { key: false, label: "Not done" },
              ].map((o) => (
                <button
                  key={String(o.key)}
                  type="button"
                  onClick={() => setDone(o.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    done === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="d-note">Note</Label>
            <Textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it go? (kept only if the day is marked done)" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
