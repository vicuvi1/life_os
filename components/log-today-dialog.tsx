"use client";

import { useEffect, useState } from "react";
import { Moon, GlassWater, Flame, Plus, Minus, PartyPopper } from "lucide-react";
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
import { upsertSleepLog, upsertNutritionLog, toggleHabitLog } from "@/lib/firebase/db";
import { formatHours } from "@/lib/sleep";
import { useToast } from "@/components/ui/toast-provider";
import type { Habit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  today: string;
  sleepLoggedToday: boolean;
  sleepDefault: { hours: number; quality: number };
  water: number;
  waterTarget: number;
  habitsRemaining: Habit[];
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
  habitsRemaining,
  onSaved,
}: Props) {
  const { toast } = useToast();

  const [sleepDone, setSleepDone] = useState(sleepLoggedToday);
  const [hours, setHours] = useState(sleepDefault.hours);
  const [quality, setQuality] = useState(sleepDefault.quality);
  const [savingSleep, setSavingSleep] = useState(false);

  const [waterLocal, setWaterLocal] = useState(water);
  const [remainingHabits, setRemainingHabits] = useState<Habit[]>(habitsRemaining);

  // Reset local state whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return;
    setSleepDone(sleepLoggedToday);
    setHours(sleepDefault.hours);
    setQuality(sleepDefault.quality);
    setWaterLocal(water);
    setRemainingHabits(habitsRemaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const waterDone = waterLocal >= waterTarget;
  const habitsDone = remainingHabits.length === 0;
  const allDone = sleepDone && waterDone && habitsDone;

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

  async function adjustWater(delta: number) {
    const next = Math.max(0, waterLocal + delta);
    setWaterLocal(next);
    await upsertNutritionLog(userId, today, { water: next });
    onSaved();
  }

  async function completeHabit(habit: Habit) {
    setRemainingHabits((prev) => prev.filter((h) => h.id !== habit.id));
    await toggleHabitLog(userId, habit.id, today, true);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log today</DialogTitle>
          <DialogDescription>
            Update everything left for today in one place.
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
              {!sleepDone && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Sleep last night</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Hours</span>
                      <span className="font-medium text-foreground">
                        {formatHours(hours)}
                      </span>
                    </div>
                    <Slider
                      value={hours}
                      onValueChange={setHours}
                      min={0}
                      max={12}
                      step={0.5}
                      aria-label="Hours slept"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Quality</span>
                      <span className="font-medium text-foreground">
                        {quality}/10
                      </span>
                    </div>
                    <Slider
                      value={quality}
                      onValueChange={setQuality}
                      min={1}
                      max={10}
                      step={1}
                      aria-label="Sleep quality"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLogSleep}
                    disabled={savingSleep}
                  >
                    {savingSleep ? "Logging…" : "Log sleep"}
                  </Button>
                </div>
              )}

              {!waterDone && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Water</p>
                      <p className="text-xs text-muted-foreground">
                        {waterLocal}/{waterTarget} glasses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Remove a glass"
                      onClick={() => adjustWater(-1)}
                      disabled={waterLocal <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      aria-label="Add a glass"
                      onClick={() => adjustWater(1)}
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
                        <span className="text-sm">{h.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
