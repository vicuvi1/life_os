"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
import { createHabit, updateHabit, type HabitInput } from "@/lib/firebase/db";
import {
  HABIT_CATEGORIES,
  HABIT_CATEGORY_LABEL,
  HABIT_COLORS,
  DEFAULT_HABIT_COLOR,
} from "@/lib/habits";
import { NumberField } from "@/components/ui/number-field";
import { cn } from "@/lib/utils";
import type {
  Habit,
  HabitCategory,
  HabitFrequency,
  HabitTargetType,
} from "@/lib/types";

const TARGET_TYPES: { key: HabitTargetType; label: string; hint: string }[] = [
  { key: "check", label: "Yes / No", hint: "A simple daily checkbox" },
  { key: "count", label: "Count with target", hint: "e.g. 8 glasses of water" },
  { key: "duration", label: "Duration (minutes)", hint: "e.g. 30 min meditation" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  habit?: Habit | null;
  onSaved: () => void;
}

export function HabitFormDialog({
  open,
  onOpenChange,
  userId,
  habit,
  onSaved,
}: Props) {
  const isEdit = Boolean(habit);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [category, setCategory] = useState<HabitCategory>("morning");
  const [color, setColor] = useState(DEFAULT_HABIT_COLOR);
  const [targetType, setTargetType] = useState<HabitTargetType>("check");
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(habit?.title ?? "");
    setDescription(habit?.description ?? "");
    setFrequency(habit?.frequency ?? "daily");
    setCategory(habit?.category ?? "morning");
    setColor(habit?.color ?? DEFAULT_HABIT_COLOR);
    setTargetType(habit?.targetType ?? "check");
    setTargetValue(habit?.targetValue ?? null);
    setError(null);
  }, [open, habit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your habit a name.");
      return;
    }
    if (targetType !== "check" && (targetValue == null || targetValue <= 0)) {
      setError("Set a daily target for this habit type.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: HabitInput = {
      title: title.trim(),
      description: description.trim() || null,
      frequency,
      category,
      color,
      targetType,
      targetValue: targetType === "check" ? null : targetValue,
    };
    try {
      if (isEdit && habit) {
        await updateHabit(habit.id, payload);
      } else {
        await createHabit(userId, payload);
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
          <DialogTitle>{isEdit ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            Small daily actions compound into big results.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="h-title">Name</Label>
            <Input
              id="h-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spanish lesson"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-description">Description</Label>
            <Textarea
              id="h-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as HabitCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HABIT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {HABIT_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as HabitFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* How completion is measured */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label>Completion is measured by</Label>
            <Select
              value={targetType}
              onValueChange={(v) => setTargetType(v as HabitTargetType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TARGET_TYPES.find((t) => t.key === targetType)?.hint}
            </p>
            {targetType !== "check" && (
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs">Daily target</Label>
                <NumberField
                  value={targetValue}
                  onCommit={setTargetValue}
                  min={0.5}
                  suffix={targetType === "duration" ? "min" : undefined}
                  placeholder={targetType === "duration" ? "30" : "8"}
                  aria-label="Daily target"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
                    color === c.value && "ring-2 ring-ring"
                  )}
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
