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
import { Textarea } from "@/components/ui/textarea";
import { setHabitLogNote } from "@/lib/firebase/db";
import type { Habit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  habit: Habit | null;
  date: string | null;
  currentNote: string | null;
  onSaved: () => void;
}

function prettyDate(key: string | null): string {
  if (!key) return "";
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function NoteDialog({ open, onOpenChange, userId, habit, date, currentNote, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNote(currentNote ?? "");
  }, [open, currentNote]);

  async function save() {
    if (!habit || !date) return;
    setSaving(true);
    try {
      await setHabitLogNote(userId, habit.id, date, note.trim() || null);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{habit?.emoji || "📝"}</span>
            {habit?.title ?? "Note"}
          </DialogTitle>
          <DialogDescription>Note for {prettyDate(date)} — jot down how it went (e.g. &quot;felt tired&quot;, &quot;80kg bench&quot;).</DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for this day…" rows={4} autoFocus />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
