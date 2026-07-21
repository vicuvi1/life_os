"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
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
import { TimeField } from "@/components/ui/time-field";
import {
  upsertSleepLog,
  addNap,
  updateSleepEntry,
  deleteSleepEntry,
} from "@/lib/firebase/db";
import { durationHours, formatHours, qualityRating } from "@/lib/sleep";
import { tgSend } from "@/lib/telegram";
import { formatLongDate } from "@/lib/dates";
import type { SleepKind, SleepLog } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  date: string;
  /** "sleep" or "nap" — the kind being created (ignored when editing an entry). */
  kind: SleepKind;
  /** Present when editing an existing entry. */
  entry?: SleepLog | null;
  /** Smart default quality for a fresh entry. */
  defaultQuality?: number;
  /** Prefill bedtime/wake for a NEW night's sleep (from targets or averages). */
  defaultTimes?: { bedtime?: string | null; wakeTime?: string | null };
  /** When set, a summary is pushed to Telegram after logging a night's sleep. */
  notify?: { token: string; chatId: string; target: number } | null;
  onSaved: () => void;
}

export function SleepLogDialog({ open, onOpenChange, userId, date, kind, entry, defaultQuality, defaultTimes, notify, onSaved }: Props) {
  const effectiveKind: SleepKind = entry?.kind ?? kind;
  const isNap = effectiveKind === "nap";

  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [quality, setQuality] = useState(7);
  const [awakeMin, setAwakeMin] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // New night sleep → prefill from targets/averages so it's often one tap to save.
    const seedBed = entry?.bedtime ?? (!entry && kind === "sleep" ? defaultTimes?.bedtime ?? "" : "");
    const seedWake = entry?.wakeTime ?? (!entry && kind === "sleep" ? defaultTimes?.wakeTime ?? "" : "");
    setBedtime(seedBed || "");
    setWakeTime(seedWake || "");
    setManualHours(entry && !entry.bedtime && entry.hours ? String(entry.hours) : "");
    setQuality(entry?.quality || defaultQuality || 7);
    setAwakeMin(entry?.awakeMinutes ?? 0);
    setNotes(entry?.notes ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  const tib = useMemo(() => durationHours(bedtime || null, wakeTime || null), [bedtime, wakeTime]);
  const hasTimes = tib != null;
  const hours = useMemo(() => {
    if (hasTimes) return Math.max(0, Math.round((tib! - awakeMin / 60) * 100) / 100);
    const n = Number(manualHours);
    return Number.isFinite(n) ? n : 0;
  }, [hasTimes, tib, awakeMin, manualHours]);

  const qr = qualityRating(quality);

  async function save() {
    if (hours <= 0 || hours > 24) {
      setError(hasTimes ? "Check the bedtime and wake time." : "Enter how long you slept.");
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      hours,
      quality: Math.round(quality),
      notes: notes.trim() || null,
      bedtime: hasTimes ? bedtime : null,
      wakeTime: hasTimes ? wakeTime : null,
      awakeMinutes: hasTimes ? Math.max(0, Math.round(awakeMin)) : 0,
    };
    try {
      if (entry) await updateSleepEntry(entry.id, input);
      else if (isNap) await addNap(userId, date, input);
      else await upsertSleepLog(userId, date, input);
      // Best-effort phone notification for a logged night (never blocks the save).
      if (!isNap && notify) {
        const diff = hours - notify.target;
        const text =
          `😴 <b>Sleep logged</b> — ${formatLongDate(date)}\n` +
          `${formatHours(hours)} slept${hasTimes ? ` (${bedtime}–${wakeTime})` : ""} · quality ${Math.round(quality)}/10\n` +
          `${diff >= 0 ? "✅ +" : "⚠️ −"}${formatHours(Math.abs(Math.round(diff * 100) / 100))} vs your ${notify.target}h goal`;
        void tgSend(notify.token, notify.chatId, text);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entry) return;
    setSaving(true);
    try {
      await deleteSleepEntry(entry.id);
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
            {isNap ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-400" />}
            {entry ? "Edit" : "Log"} {isNap ? "nap" : "sleep"}
          </DialogTitle>
          <DialogDescription>{formatLongDate(date)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isNap ? "Started" : "Bedtime"}</Label>
              <TimeField value={bedtime} onChange={setBedtime} ariaLabel={isNap ? "Nap start" : "Bedtime"} />
            </div>
            <div className="space-y-1.5">
              <Label>{isNap ? "Ended" : "Wake up"}</Label>
              <TimeField value={wakeTime} onChange={setWakeTime} ariaLabel={isNap ? "Nap end" : "Wake up"} />
            </div>
          </div>

          {hasTimes ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Time in bed</span>
              <span className="font-medium tabular-nums">{formatHours(tib!)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Slept</span>
              <span className="font-semibold tabular-nums">{formatHours(hours)}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sl-dur">Or enter duration (hours)</Label>
              <Input
                id="sl-dur"
                type="number"
                step="0.25"
                min={0}
                max={24}
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                placeholder={isNap ? "e.g. 0.5" : "e.g. 7.5"}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sl-q">Quality</Label>
              <span className="text-xs font-medium text-muted-foreground">{quality}/10 · {qr.label}</span>
            </div>
            <input
              id="sl-q"
              type="range"
              min={1}
              max={10}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {hasTimes && !isNap && (
            <div className="space-y-1.5">
              <Label htmlFor="sl-awake">Awake during the night (min)</Label>
              <Input
                id="sl-awake"
                type="number"
                min={0}
                max={600}
                value={awakeMin || ""}
                onChange={(e) => setAwakeMin(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sl-notes">Notes</Label>
            <Textarea id="sl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Woke up once, went to bed late…" rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="sm:justify-between">
          {entry ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={saving}>
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving || hours <= 0}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
