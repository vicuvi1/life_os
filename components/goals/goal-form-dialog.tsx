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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGoal, updateGoal, type GoalInput } from "@/lib/firebase/db";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  GOAL_STATUSES,
  GOAL_STATUS_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
} from "@/lib/labels";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import type {
  Goal,
  GoalCategory,
  GoalProgressType,
  GoalStatus,
  Priority,
} from "@/lib/types";

const PROGRESS_TYPES: { key: GoalProgressType; label: string; hint: string }[] = [
  { key: "percent", label: "Percent (auto)", hint: "Calculated from completed tasks" },
  { key: "count", label: "Count toward a target", hint: "e.g. 500 of 2000 saved" },
  { key: "manual", label: "Manual", hint: "You set the % yourself" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  goal?: Goal | null;
  onSaved: () => void;
}

const NO_CATEGORY = "__none__";

export function GoalFormDialog({
  open,
  onOpenChange,
  userId,
  goal,
  onSaved,
}: Props) {
  const isEdit = Boolean(goal);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<string>(NO_CATEGORY);
  const [deadline, setDeadline] = useState("");
  const [quarter, setQuarter] = useState("");
  const [progressType, setProgressType] = useState<GoalProgressType>("percent");
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [unit, setUnit] = useState("");
  const [manualProgress, setManualProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setStatus(goal?.status ?? "active");
    setPriority(goal?.priority ?? "medium");
    setCategory(goal?.category ?? NO_CATEGORY);
    setDeadline(goal?.deadline ?? "");
    setQuarter(goal?.quarter ?? "");
    setProgressType(goal?.progressType ?? "percent");
    setTargetValue(goal?.targetValue ?? null);
    setCurrentValue(goal?.currentValue ?? null);
    setUnit(goal?.unit ?? "");
    setManualProgress(goal?.progress ?? 0);
    setError(null);
  }, [open, goal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your goal a title.");
      return;
    }
    if (progressType === "count" && (targetValue == null || targetValue <= 0)) {
      setError("Set a target number for a count goal.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: GoalInput = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      category: category === NO_CATEGORY ? null : (category as GoalCategory),
      deadline: deadline || null,
      quarter: quarter.trim() || null,
      progressType,
      targetValue: progressType === "count" ? targetValue : null,
      currentValue: progressType === "count" ? currentValue ?? 0 : null,
      unit: progressType === "count" ? unit.trim() || null : null,
    };
    // Count goals derive progress from current/target; manual goals take the
    // slider value; percent goals leave progress to task auto-calc.
    if (progressType === "count" && targetValue != null && targetValue > 0) {
      payload.progress = Math.max(
        0,
        Math.min(100, Math.round(((currentValue ?? 0) / targetValue) * 100))
      );
    } else if (progressType === "manual") {
      payload.progress = Math.round(manualProgress);
    }

    try {
      if (isEdit && goal) {
        await updateGoal(goal.id, payload);
      } else {
        await createGoal(userId, payload);
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
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of your goal."
              : "Focus on just a few goals at a time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reach C1 English"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as GoalStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {GOAL_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter</Label>
              <Input
                id="quarter"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="e.g. Q3 2026"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* How progress is measured */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label>Progress is measured by</Label>
            <Select
              value={progressType}
              onValueChange={(v) => setProgressType(v as GoalProgressType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRESS_TYPES.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PROGRESS_TYPES.find((p) => p.key === progressType)?.hint}
            </p>

            {progressType === "count" && (
              <div className="flex flex-wrap items-end gap-4 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Current</Label>
                  <NumberField
                    value={currentValue}
                    onCommit={setCurrentValue}
                    min={0}
                    placeholder="0"
                    aria-label="Current value"
                    inputClassName="w-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target</Label>
                  <NumberField
                    value={targetValue}
                    onCommit={setTargetValue}
                    min={0.01}
                    placeholder="e.g. 2000"
                    aria-label="Target value"
                    inputClassName="w-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="g-unit" className="text-xs">
                    Unit
                  </Label>
                  <Input
                    id="g-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. $, pages"
                    className="h-8 w-24"
                  />
                </div>
              </div>
            )}

            {progressType === "manual" && (
              <div className="flex items-center gap-3 pt-1">
                <Slider
                  value={manualProgress}
                  onValueChange={setManualProgress}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                  aria-label="Progress percent"
                />
                <NumberField
                  value={manualProgress}
                  onCommit={setManualProgress}
                  min={0}
                  max={100}
                  decimals={false}
                  suffix="%"
                  aria-label="Progress percent"
                />
              </div>
            )}
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
