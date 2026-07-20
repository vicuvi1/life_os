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
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTracker,
  updateTracker,
  type TrackerInput,
} from "@/lib/firebase/db";
import {
  TRACKER_TYPES,
  TRACKER_ICONS,
  DEFAULT_TRACKER_ICON,
} from "@/lib/trackers";
import { cn } from "@/lib/utils";
import type { Tracker, TrackerType } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  tracker?: Tracker | null;
  /** Used as the sortOrder for newly created trackers. */
  nextSortOrder?: number;
  onSaved: () => void;
}

export function TrackerFormDialog({
  open,
  onOpenChange,
  userId,
  tracker,
  nextSortOrder = 0,
  onSaved,
}: Props) {
  const isEdit = Boolean(tracker);
  const [name, setName] = useState("");
  const [type, setType] = useState<TrackerType>("number");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [icon, setIcon] = useState(DEFAULT_TRACKER_ICON);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(tracker?.name ?? "");
    setType(tracker?.type ?? "number");
    setUnit(tracker?.unit ?? "");
    setTarget(tracker?.target ?? null);
    setIcon(tracker?.icon ?? DEFAULT_TRACKER_ICON);
    setError(null);
  }, [open, tracker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your tracker a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: TrackerInput = {
      name: name.trim(),
      type,
      unit: type === "duration" ? unit.trim() || "min" : unit.trim() || null,
      target: type === "yesno" ? null : target,
      icon,
    };
    try {
      if (isEdit && tracker) {
        await updateTracker(tracker.id, payload);
      } else {
        await createTracker(userId, payload, nextSortOrder);
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
          <DialogTitle>{isEdit ? "Edit tracker" : "New tracker"}</DialogTitle>
          <DialogDescription>
            Track any metric that matters to you, alongside the built-ins.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tr-name">Name</Label>
            <Input
              id="tr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Job applications sent"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TrackerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACKER_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TRACKER_TYPES.find((t) => t.key === type)?.hint}
              </p>
            </div>
            {type !== "yesno" && (
              <div className="space-y-2">
                <Label htmlFor="tr-unit">Unit</Label>
                <Input
                  id="tr-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder={type === "duration" ? "min" : "e.g. kg, apps"}
                />
                <div className="flex items-center gap-2 pt-1">
                  <Label className="text-xs">Daily target</Label>
                  <NumberField
                    value={target}
                    onCommit={setTarget}
                    min={0}
                    placeholder="—"
                    aria-label="Daily target"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TRACKER_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => setIcon(key)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    icon === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create tracker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
