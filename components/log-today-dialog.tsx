"use client";

import { useEffect, useState } from "react";
import {
  Moon,
  GlassWater,
  Flame,
  Plus,
  Minus,
  PartyPopper,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "@/components/ui/number-field";
import {
  upsertSleepLog,
  upsertNutritionLog,
  toggleHabitLog,
  setTrackerLog,
} from "@/lib/firebase/db";
import { formatHours } from "@/lib/sleep";
import { trackerIcon, formatTrackerValue } from "@/lib/trackers";
import { useToast } from "@/components/ui/toast-provider";
import type { Habit, Tracker } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  today: string;
  sleepLoggedToday: boolean;
  sleepDefault: { hours: number; quality: number };
  water: number;
  waterTarget: number;
  waterUnit: string;
  habitsRemaining: Habit[];
  trackersDue: Tracker[];
  hiddenTrackers: string[];
  onSaved: () => void;
}

export function LogTodayDialog({
  open,
  onOpenChange,
  userId,
  today,
  sleepLoggedToday,
  sleepDefault,
  water,
  waterTarget,
  waterUnit,
  habitsRemaining,
  trackersDue,
  hiddenTrackers,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const hidden = new Set(hiddenTrackers);

  const [sleepDone, setSleepDone] = useState(sleepLoggedToday);
  const [hours, setHours] = useState(sleepDefault.hours);
  const [quality, setQuality] = useState(sleepDefault.quality);
  const [sleepTouched, setSleepTouched] = useState(false);
  const [savingSleep, setSavingSleep] = useState(false);

  const [waterLocal, setWaterLocal] = useState(water);
  const [remainingHabits, setRemainingHabits] = useState<Habit[]>(habitsRemaining);
  const [remainingTrackers, setRemainingTrackers] = useState<Tracker[]>(trackersDue);
  const [trackerValues, setTrackerValues] = useState<Record<string, number>>({});

  // Reset local state whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return;
    setSleepDone(sleepLoggedToday);
    setHours(sleepDefault.hours);
    setQuality(sleepDefault.quality);
    setSleepTouched(false);
    setWaterLocal(water);
    setRemainingHabits(habitsRemaining);
    setRemainingTrackers(trackersDue);
    const init: Record<string, number> = {};
    for (const t of trackersDue) init[t.id] = t.target ?? 0;
    setTrackerValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sleepHidden = hidden.has("sleep");
  const waterHidden = hidden.has("water");
  const habitsHidden = hidden.has("habits");

  const waterDone = waterHidden || waterLocal >= waterTarget;
  const habitsDone = habitsHidden || remainingHabits.length === 0;
  const sleepOk = sleepHidden || sleepDone;
  const trackersDone = remainingTrackers.length === 0;
  const allDone = sleepOk && waterDone && habitsDone && trackersDone;

  // Auto-close and celebrate once every visible section is complete.
  useEffect(() => {
    if (!open || !allDone) return;
    const t = setTimeout(() => {
      onOpenChange(false);
      onSaved();
      toast({ title: "All logged for today 🎉", description: "Nice work." });
    }, 500);
    return () => clearTimeout(t);
  }, [open, allDone, onOpenChange, onSaved, toast]);

  async function handleLogSleep() {
    setSavingSleep(true);
    try {
      await upsertSleepLog(userId, today, { hours, quality, notes: null });
      setSleepDone(true);
      onSaved();
    } finally {
      setSavingSleep(false);
    }
  }

  async function setWaterValue(next: number) {
    const v = Math.max(0, Math.round(next * 100) / 100);
    setWaterLocal(v);
    await upsertNutritionLog(userId, today, { water: v });
    onSaved();
  }

  async function completeHabit(habit: Habit) {
    setRemainingHabits((prev) => prev.filter((h) => h.id !== habit.id));
    await toggleHabitLog(
      userId,
      habit.id,
      today,
      true,
      (habit.targetType ?? "check") !== "check" ? habit.targetValue : null
    );
    onSaved();
  }

  async function logTracker(tracker: Tracker, value: number) {
    setRemainingTrackers((prev) => prev.filter((t) => t.id !== tracker.id));
    await setTrackerLog(userId, tracker.id, today, value);
    onSaved();
  }

  const waterStep = waterUnit === "liters" ? 0.25 : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log today</DialogTitle>
          <DialogDescription>
            Update everything left for today in one place. Every number is
            directly typeable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {allDone ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <PartyPopper className="h-8 w-8 text-primary" />
              <p className="font-medium">All caught up for today</p>
            </div>
          ) : (
            <>
              {!sleepOk && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Sleep last night</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Hours</span>
                      <NumberField
                        value={hours}
                        onCommit={(v) => {
                          setHours(v);
                          setSleepTouched(true);
                        }}
                        min={0}
                        max={24}
                        suffix="h"
                        suggested={!sleepTouched}
                        aria-label="Hours slept"
                      />
                    </div>
                    <Slider
                      value={hours}
                      onValueChange={(v) => {
                        setHours(v);
                        setSleepTouched(true);
                      }}
                      min={0}
                      max={12}
                      step={0.5}
                      aria-label="Hours slept"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Quality</span>
                      <NumberField
                        value={quality}
                        onCommit={(v) => {
                          setQuality(v);
                          setSleepTouched(true);
                        }}
                        min={1}
                        max={10}
                        decimals={false}
                        suffix="/10"
                        suggested={!sleepTouched}
                        aria-label="Sleep quality"
                      />
                    </div>
                    <Slider
                      value={quality}
                      onValueChange={(v) => {
                        setQuality(v);
                        setSleepTouched(true);
                      }}
                      min={1}
                      max={10}
                      step={1}
                      aria-label="Sleep quality"
                    />
                  </div>
                  <Button size="sm" onClick={handleLogSleep} disabled={savingSleep}>
                    {savingSleep ? "Logging…" : `Log ${formatHours(hours)}`}
                  </Button>
                </div>
              )}

              {!waterDone && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Water</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <NumberField
                          value={waterLocal}
                          onCommit={setWaterValue}
                          min={0}
                          decimals={waterUnit === "liters"}
                          aria-label="Water logged"
                          inputClassName="w-12"
                        />
                        / {waterTarget} {waterUnit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => setWaterValue(waterLocal - waterStep)}
                      disabled={waterLocal <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      aria-label="Add"
                      onClick={() => setWaterValue(waterLocal + waterStep)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {!habitsDone && (
                <div className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      Habits ({remainingHabits.length} left)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {remainingHabits.map((h) => (
                      <label
                        key={h.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
                      >
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => completeHabit(h)}
                        />
                        <span className="text-sm">
                          {h.title}
                          {(h.targetType ?? "check") !== "check" &&
                            h.targetValue != null && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {h.targetValue}
                                {h.targetType === "duration" ? " min" : ""}
                              </span>
                            )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {remainingTrackers.map((t) => {
                const Icon = trackerIcon(t.icon);
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        {t.target != null && t.type !== "yesno" && (
                          <p className="text-xs text-muted-foreground">
                            Target: {formatTrackerValue(t, t.target)}
                          </p>
                        )}
                      </div>
                    </div>
                    {t.type === "yesno" ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="sm" onClick={() => logTracker(t, 1)}>
                          <Check className="h-4 w-4" /> Yes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => logTracker(t, 0)}
                        >
                          <X className="h-4 w-4" /> No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <NumberField
                          value={trackerValues[t.id] ?? 0}
                          onCommit={(v) =>
                            setTrackerValues((prev) => ({ ...prev, [t.id]: v }))
                          }
                          min={0}
                          decimals={t.type !== "count"}
                          suffix={t.unit ?? undefined}
                          aria-label={`${t.name} value`}
                        />
                        <Button
                          size="sm"
                          onClick={() => logTracker(t, trackerValues[t.id] ?? 0)}
                        >
                          Log
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
