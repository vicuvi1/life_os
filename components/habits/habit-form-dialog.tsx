"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
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

const EMOJI_PRESETS = ["💧", "🏃", "🧘", "📚", "💪", "🥗", "😴", "☀️", "🌙", "🚭", "💊", "🧠", "✍️", "🎯", "🙏", "🚿", "🦷", "💻"];

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
  const [emoji, setEmoji] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
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
    setEmoji(habit?.emoji ?? "");
    setTags(habit?.tags ?? []);
    setTagInput("");
    setFrequency(habit?.frequency ?? "daily");
    setCategory(habit?.category ?? "morning");
    setColor(habit?.color ?? DEFAULT_HABIT_COLOR);
    setTargetType(habit?.targetType ?? "check");
    setTargetValue(habit?.targetValue ?? null);
    setError(null);
  }, [open, habit]);

  function addTag(raw: string) {
    const parts = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    setTags((prev) => {
      const next = [...prev];
      for (const p of parts) if (!next.includes(p)) next.push(p);
      return next;
    });
    setTagInput("");
  }

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
      emoji: emoji.trim() || null,
      tags,
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
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            Small daily actions compound into big results.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="h-title">Name</Label>
            <div className="flex gap-2">
              <Input
                aria-label="Emoji"
                value={emoji}
                onChange={(e) => setEmoji([...e.target.value].slice(-2).join(""))}
                placeholder="🙂"
                className="w-14 shrink-0 text-center text-lg"
              />
              <Input
                id="h-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spanish lesson"
                autoFocus
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-accent",
                    emoji === e && "bg-accent ring-1 ring-ring"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-description">Description</Label>
            <Textarea
              id="h-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note — why this habit matters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-tags">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="h-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tags.length === 0 ? "health, morning… (Enter to add)" : ""}
                className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
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
