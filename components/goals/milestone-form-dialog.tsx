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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/ui/number-field";
import {
  MILESTONE_MEASUREMENTS,
  makeMilestone,
  makeMilestoneStep,
} from "@/lib/goals";
import type {
  GoalMilestone,
  GoalMilestoneStep,
  MilestoneMeasurement,
  Task,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalTasks: Task[];
  milestone: GoalMilestone | null;
  nextOrder: number;
  onSave: (milestone: GoalMilestone) => void;
}

export function MilestoneFormDialog({
  open,
  onOpenChange,
  goalTasks,
  milestone,
  nextOrder,
  onSave,
}: Props) {
  const isEdit = Boolean(milestone);
  const [title, setTitle] = useState("");
  const [measurement, setMeasurement] = useState<MilestoneMeasurement>("check");
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [unit, setUnit] = useState("");
  const [weight, setWeight] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [autoComplete, setAutoComplete] = useState(false);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<GoalMilestoneStep[]>([]);
  const [stepDraft, setStepDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(milestone?.title ?? "");
    setMeasurement(milestone?.measurement ?? "check");
    setTargetValue(milestone?.targetValue ?? null);
    setUnit(milestone?.unit ?? "");
    setWeight(milestone?.weight ?? 1);
    setDueDate(milestone?.dueDate ?? "");
    setAutoComplete(milestone?.autoComplete ?? false);
    setLinkedTaskIds(milestone?.linkedTaskIds ?? []);
    setSteps(milestone?.steps ?? []);
    setStepDraft("");
    setError(null);
  }, [open, milestone]);

  function addStep() {
    const v = stepDraft.trim();
    if (!v) return;
    setSteps((prev) => [...prev, makeMilestoneStep(v)]);
    setStepDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the milestone a title.");
    if (measurement === "count" && (targetValue == null || targetValue <= 0))
      return setError("Set a target for a count milestone.");

    const base = milestone ?? makeMilestone(nextOrder);
    const next: GoalMilestone = {
      ...base,
      title: title.trim(),
      measurement,
      targetValue: measurement === "count" ? targetValue : null,
      unit: measurement === "count" ? unit.trim() || null : null,
      weight: weight > 0 ? weight : 1,
      dueDate: dueDate || null,
      autoComplete,
      linkedTaskIds,
      steps: measurement === "steps" ? steps : base.steps,
    };
    onSave(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit milestone" : "New milestone"}</DialogTitle>
          <DialogDescription>
            A step toward the goal. It can be a checkbox, a count, or its own
            sub-checklist.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Score 80+ on 3 practice exams"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Measured by</Label>
              <Select
                value={measurement}
                onValueChange={(v) => setMeasurement(v as MilestoneMeasurement)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_MEASUREMENTS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight</Label>
              <NumberField
                value={weight}
                onCommit={(v) => setWeight(v && v > 0 ? v : 1)}
                min={0.1}
                inputClassName="w-20"
                aria-label="Weight"
              />
            </div>
          </div>

          {measurement === "count" && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Target</Label>
                <NumberField
                  value={targetValue}
                  onCommit={setTargetValue}
                  min={0.01}
                  placeholder="e.g. 3"
                  inputClassName="w-20"
                  aria-label="Target"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-unit" className="text-xs">
                  Unit
                </Label>
                <Input
                  id="m-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="exams"
                  className="h-8 w-28"
                />
              </div>
            </div>
          )}

          {measurement === "steps" && (
            <div className="space-y-2">
              <Label>Sub-steps</Label>
              {steps.length > 0 && (
                <div className="space-y-1">
                  {steps.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <span className="flex-1">{s.title}</span>
                      <button
                        type="button"
                        onClick={() => setSteps((p) => p.filter((x) => x.id !== s.id))}
                        aria-label={`Remove ${s.title}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addStep();
                    }
                  }}
                  placeholder="Add a sub-step"
                />
                <Button type="button" variant="outline" onClick={addStep}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="m-due">Due date</Label>
            <Input
              id="m-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Linked tasks */}
          {goalTasks.length > 0 && (
            <div className="space-y-2">
              <Label>Link tasks</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {goalTasks.map((t) => {
                  const on = linkedTaskIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={on}
                        onCheckedChange={() =>
                          setLinkedTaskIds((prev) =>
                            on ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                          )
                        }
                        aria-label={t.title}
                      />
                      <span className="flex-1 truncate">{t.title}</span>
                    </label>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={autoComplete}
                  onCheckedChange={(c) => setAutoComplete(Boolean(c))}
                  disabled={linkedTaskIds.length === 0}
                  aria-label="Auto-complete"
                />
                Mark this milestone done automatically when all linked tasks are complete
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save milestone" : "Add milestone"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
