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
import { formatHours, qualityRating, parseHM } from "@/lib/sleep";
import { tgSend } from "@/lib/telegram";
import { formatLongDate } from "@/lib/dates";
import { addDays } from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { SleepKind, SleepLog } from "@/lib/types";

function weekdayShort(dateKey: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${dateKey}T00:00:00`).getDay()];
}

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
  /** Whether bedtime is the night before the wake date (vs the same morning). */
  const [bedPrevDay, setBedPrevDay] = useState(true);
  const [bedDayTouched, setBedDayTouched] = useState(false);
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
    // Default: an evening/afternoon bedtime is the night before; a morning one is the same day.
    const bh = parseHM(seedBed || "");
    setBedPrevDay(bh == null ? true : bh >= 12 * 60);
    setBedDayTouched(false);
    setManualHours(entry && !entry.bedtime && entry.hours ? String(entry.hours) : "");
    setQuality(entry?.quality || defaultQuality || 7);
    setAwakeMin(entry?.awakeMinutes ?? 0);
    setNotes(entry?.notes ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  const bedM = parseHM(bedtime);
  const wakeM = parseHM(wakeTime);
  const hasTimes = bedM != null && wakeM != null;
  // Day-aware time in bed: bedtime may be the night before the wake date.
  const tib = useMemo(() => {
    if (bedM == null || wakeM == null) return null;
    let mins = isNap ? wakeM - bedM : bedPrevDay ? 1440 - bedM + wakeM : wakeM - bedM;
    if (mins <= 0) mins += 1440;
    return Math.round((mins / 60) * 100) / 100;
  }, [bedM, wakeM, isNap, bedPrevDay]);
  const hours = useMemo(() => {
    if (tib != null) return Math.max(0, Math.round((tib - awakeMin / 60) * 100) / 100);
    const n = Number(manualHours);
    return Number.isFinite(n) ? n : 0;
  }, [tib, awakeMin, manualHours]);

  function handleBedtime(v: string) {
    setBedtime(v);
    if (!bedDayTouched) {
      const h = parseHM(v);
      setBedPrevDay(h == null ? true : h >= 12 * 60);
    }
  }

  const bedDayDate = bedPrevDay ? addDays(date, -1) : date;
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
              <div className="flex items-center justify-between">
                <Label>{isNap ? "Started" : "Bedtime"}</Label>
                {!isNap && (
                  <div className="flex overflow-hidden rounded-md border text-[10px]">
                    {([["prev", "Night before"], ["same", "Same day"]] as const).map(([k, lbl]) => {
                      const on = (k === "prev") === bedPrevDay;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setBedPrevDay(k === "prev"); setBedDayTouched(true); }}
                          className={cn("px-1.5 py-0.5 transition", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <TimeField value={bedtime} onChange={handleBedtime} ariaLabel={isNap ? "Nap start" : "Bedtime"} />
            </div>
            <div className="space-y-1.5">
              <Label>{isNap ? "Ended" : "Wake up"}</Label>
              <TimeField value={wakeTime} onChange={setWakeTime} ariaLabel={isNap ? "Nap end" : "Wake up"} />
            </div>
          </div>

          {hasTimes ? (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{weekdayShort(bedDayDate)} {bedtime}</span>
                <span>→</span>
                <span>{weekdayShort(date)} {wakeTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time in bed <span className="font-medium tabular-nums text-foreground">{formatHours(tib!)}</span></span>
                <span className="text-muted-foreground">Slept <span className="font-semibold tabular-nums text-foreground">{formatHours(hours)}</span></span>
              </div>
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
