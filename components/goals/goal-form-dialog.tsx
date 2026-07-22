"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { createGoal, updateGoal, type GoalInput } from "@/lib/firebase/db";
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
} from "@/lib/labels";
import {
  CATEGORY_SUGGESTIONS,
  GOAL_COLORS,
  GOAL_ICONS,
  MEASUREMENTS,
  compositeProgress,
  makeCompositeComponent,
} from "@/lib/goals";
import { cn } from "@/lib/utils";
import type {
  Goal,
  GoalCompositeComponent,
  GoalMeasurement,
  GoalStatus,
  Priority,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  goal?: Goal | null;
  onSaved: () => void;
}

const clampPct = (cur: number, tar: number) =>
  tar > 0 ? Math.max(0, Math.min(100, Math.round((cur / tar) * 100))) : 0;

export function GoalFormDialog({ open, onOpenChange, userId, goal, onSaved }: Props) {
  const isEdit = Boolean(goal);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState("");
  const [quarter, setQuarter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState<number | null>(null);

  const [measurement, setMeasurement] = useState<GoalMeasurement>("tasks");
  const [manualProgress, setManualProgress] = useState(0);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [unit, setUnit] = useState("");
  const [composite, setComposite] = useState<GoalCompositeComponent[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setStatus(goal?.status ?? "active");
    setPriority(goal?.priority ?? "medium");
    setCategory(goal?.category ?? "");
    setQuarter(goal?.quarter ?? "");
    setStartDate(goal?.startDate ?? "");
    setDeadline(goal?.deadline ?? "");
    setIcon(goal?.icon ?? null);
    setColor(goal?.color ?? null);
    setStaleDays(goal?.staleDays ?? null);
    setMeasurement(goal?.measurement ?? "tasks");
    setManualProgress(goal?.progress ?? 0);
    setCurrentValue(goal?.currentValue ?? null);
    setTargetValue(goal?.targetValue ?? null);
    setUnit(goal?.unit ?? "");
    setComposite(goal?.composite ?? []);
    setError(null);
  }, [open, goal]);

  const compositePct = compositeProgress(composite);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give your goal a title.");
    if (measurement === "count" && (targetValue == null || targetValue <= 0))
      return setError("Set a target number for a count goal.");
    if (measurement === "linked" && (targetValue == null || targetValue <= 0))
      return setError("Set a target number of hours for a linked-time goal.");
    if (measurement === "composite" && composite.length === 0)
      return setError("Add at least one sub-metric for a composite goal.");

    setSaving(true);
    setError(null);

    const payload: GoalInput = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      measurement,
      category: category.trim() || null,
      quarter: quarter.trim() || null,
      startDate: startDate || null,
      deadline: deadline || null,
      icon,
      color,
      staleDays,
      targetValue:
        measurement === "count" || measurement === "linked" ? targetValue : null,
      currentValue: measurement === "count" ? currentValue ?? 0 : null,
      unit:
        measurement === "count"
          ? unit.trim() || null
          : measurement === "linked"
            ? "h"
            : null,
      composite: measurement === "composite" ? composite : [],
      // Milestones are edited in the goal's detail view — preserve them here.
      milestones: goal?.milestones ?? [],
    };
    if (measurement === "percentage") payload.progress = Math.round(manualProgress);
    else if (measurement === "count")
      payload.progress = clampPct(currentValue ?? 0, targetValue ?? 0);
    else if (measurement === "composite") payload.progress = compositePct;

    try {
      if (isEdit && goal) await updateGoal(goal.id, payload);
      else await createGoal(userId, payload);
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const activeMeasurement = MEASUREMENTS.find((m) => m.key === measurement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details of your goal." : "Focus on a few goals at a time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-title">Title</Label>
            <Input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reach C1 English"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
            />
          </div>

          {/* Icon + color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setIcon(null)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md border text-xs text-muted-foreground transition-colors",
                    icon === null ? "border-primary bg-primary/10" : "hover:bg-accent"
                  )}
                  aria-label="No icon"
                >
                  —
                </button>
                {GOAL_ICONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setIcon(em)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors",
                      icon === em ? "border-primary bg-primary/10" : "hover:bg-accent"
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(color === c ? null : c)}
                    className={cn(
                      "h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                      color === c && "ring-2 ring-foreground"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Status / priority / category / quarter */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
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
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
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
              <Label htmlFor="g-cat">Category</Label>
              <Input
                id="g-cat"
                list="goal-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Education"
              />
              <datalist id="goal-categories">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-quarter">Quarter</Label>
              <Input
                id="g-quarter"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="e.g. Q3 2026"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="g-start">Start date</Label>
              <Input
                id="g-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-target">Target date</Label>
              <Input
                id="g-target"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Flag as stale after (days idle)</Label>
            <div className="flex items-center gap-2">
              <NumberField
                value={staleDays}
                onCommit={(v) => setStaleDays(v && v > 0 ? Math.round(v) : null)}
                min={1}
                decimals={false}
                placeholder="14"
                inputClassName="w-20"
                aria-label="Flag as stale after days"
              />
              <span className="text-xs text-muted-foreground">
                No progress for this many days → &quot;Needs attention&quot;. Default 14.
              </span>
            </div>
          </div>

          {/* Measurement */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label>How progress is measured</Label>
            <Select
              value={measurement}
              onValueChange={(v) => setMeasurement(v as GoalMeasurement)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEASUREMENTS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{activeMeasurement?.hint}</p>

            {measurement === "percentage" && (
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
                  onCommit={(v) => setManualProgress(v ?? 0)}
                  min={0}
                  max={100}
                  decimals={false}
                  suffix="%"
                  aria-label="Progress percent"
                />
              </div>
            )}

            {measurement === "count" && (
              <div className="flex flex-wrap items-end gap-4 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Current</Label>
                  <NumberField
                    value={currentValue}
                    onCommit={setCurrentValue}
                    min={0}
                    placeholder="0"
                    inputClassName="w-20"
                    aria-label="Current value"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target</Label>
                  <NumberField
                    value={targetValue}
                    onCommit={setTargetValue}
                    min={0.01}
                    placeholder="e.g. 300"
                    inputClassName="w-20"
                    aria-label="Target value"
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
                    placeholder="applications"
                    className="h-8 w-32"
                  />
                </div>
              </div>
            )}

            {measurement === "linked" && (
              <div className="flex flex-wrap items-end gap-4 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Target hours</Label>
                  <NumberField
                    value={targetValue}
                    onCommit={setTargetValue}
                    min={0.5}
                    placeholder="e.g. 40"
                    inputClassName="w-24"
                    aria-label="Target hours"
                  />
                </div>
                <p className="pb-1.5 text-xs text-muted-foreground">
                  Progress = hours logged in Sessions tagged to this goal.
                </p>
              </div>
            )}

            {measurement === "milestones" && (
              <p className="pt-1 text-xs text-muted-foreground">
                Add milestones in the goal&apos;s detail view — progress is the
                weighted completion of those milestones.
              </p>
            )}

            {measurement === "tasks" && (
              <p className="pt-1 text-xs text-muted-foreground">
                Progress is auto-calculated from this goal&apos;s completed tasks.
              </p>
            )}

            {measurement === "composite" && (
              <div className="space-y-2 pt-1">
                {composite.map((c, i) => (
                  <div key={c.id} className="rounded-md border p-2">
                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        value={c.label}
                        onChange={(e) =>
                          setComposite((prev) =>
                            prev.map((x) =>
                              x.id === c.id ? { ...x, label: e.target.value } : x
                            )
                          )
                        }
                        placeholder={`Metric ${i + 1} (e.g. Study hours)`}
                        className="h-8"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setComposite((prev) => prev.filter((x) => x.id !== c.id))
                        }
                        aria-label="Remove metric"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Current</Label>
                        <NumberField
                          value={c.current}
                          onCommit={(v) =>
                            setComposite((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, current: v ?? 0 } : x))
                            )
                          }
                          min={0}
                          inputClassName="w-16"
                          aria-label="Current"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Target</Label>
                        <NumberField
                          value={c.target}
                          onCommit={(v) =>
                            setComposite((prev) =>
                              prev.map((x) =>
                                x.id === c.id ? { ...x, target: v && v > 0 ? v : 1 } : x
                              )
                            )
                          }
                          min={0.01}
                          inputClassName="w-16"
                          aria-label="Target"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Weight</Label>
                        <NumberField
                          value={c.weight}
                          onCommit={(v) =>
                            setComposite((prev) =>
                              prev.map((x) =>
                                x.id === c.id ? { ...x, weight: v && v > 0 ? v : 1 } : x
                              )
                            )
                          }
                          min={0.1}
                          inputClassName="w-16"
                          aria-label="Weight"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setComposite((prev) => [...prev, makeCompositeComponent()])}
                  >
                    <Plus className="h-4 w-4" /> Add sub-metric
                  </Button>
                  {composite.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Overall {compositePct}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
