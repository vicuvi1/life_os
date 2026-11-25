"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAfterDeadline } from "@/lib/planner";

export interface QuickAddValues {
  title: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
}

interface Props {
  /** Persist the task; reject to keep the draft and show an error. */
  onAdd: (values: QuickAddValues) => Promise<void>;
  goal?: { deadline: string | null } | null;
  /** Prefilled day (e.g. when adding from a calendar day). */
  defaultDate?: string | null;
  placeholder?: string;
  /** Unique suffix so several quick-adds on one page keep distinct ids. */
  idSuffix: string;
}

/** Inline "type a task, optionally a day and an estimate, press Enter". */
export function TaskQuickAdd({
  onAdd,
  goal,
  defaultDate = null,
  placeholder = "Add a task…",
  idSuffix,
}: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const late = isAfterDeadline(date, goal);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || saving) return;
    const mins = Math.round(Number(minutes));
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        title: t,
        dueDate: date || null,
        estimatedMinutes: minutes.trim() !== "" && Number.isFinite(mins) && mins > 0 ? mins : null,
      });
      setTitle("");
      setMinutes("");
      setDate(defaultDate ?? "");
    } catch {
      setError("Couldn't add the task. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-1.5 px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 min-w-[10rem] flex-1 basis-full sm:basis-0"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Day (optional)"
          className="h-9 w-[9.5rem] flex-1 sm:flex-none"
        />
        <Input
          id={`qa-min-${idSuffix}`}
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="min"
          aria-label="Estimated minutes (optional)"
          className="h-9 w-20"
        />
        <Button type="submit" size="sm" className="h-9" disabled={!title.trim() || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>
      {late && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          That day is after this goal&apos;s deadline ({goal?.deadline}).
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
