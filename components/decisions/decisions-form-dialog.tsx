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
import { upsertDecisions, type DecisionInput } from "@/lib/firebase/db";
import { WEEKDAYS } from "@/lib/decisions";
import type { DecisionConfig, WeekdayKey } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  config: DecisionConfig | null;
  onSaved: () => void;
}

export function DecisionsFormDialog({
  open,
  onOpenChange,
  userId,
  config,
  onSaved,
}: Props) {
  const [outfits, setOutfits] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<{ label: string; value: string }[]>(
    []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const o: Record<string, string> = {};
    for (const w of WEEKDAYS) o[w.key] = config?.outfits?.[w.key] ?? "";
    setOutfits(o);
    setDefaults(config?.defaults?.length ? [...config.defaults] : [{ label: "", value: "" }]);
  }, [open, config]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleanOutfits: Partial<Record<WeekdayKey, string>> = {};
    for (const w of WEEKDAYS) {
      const v = (outfits[w.key] ?? "").trim();
      if (v) cleanOutfits[w.key] = v;
    }
    const cleanDefaults = defaults
      .map((d) => ({ label: d.label.trim(), value: d.value.trim() }))
      .filter((d) => d.label && d.value);

    const payload: DecisionInput = {
      outfits: cleanOutfits,
      defaults: cleanDefaults,
    };
    try {
      await upsertDecisions(userId, payload);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-decide your routine</DialogTitle>
          <DialogDescription>
            Set it once so you never have to decide again — just execute.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Outfit by day</Label>
            <div className="space-y-2">
              {WEEKDAYS.map((w) => (
                <div key={w.key} className="flex items-center gap-3">
                  <span className="w-10 text-sm text-muted-foreground">
                    {w.short}
                  </span>
                  <Input
                    value={outfits[w.key] ?? ""}
                    onChange={(e) =>
                      setOutfits((s) => ({ ...s, [w.key]: e.target.value }))
                    }
                    placeholder="e.g. Blue shirt + black jeans"
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fixed defaults</Label>
            <div className="space-y-2">
              {defaults.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={d.label}
                    onChange={(e) =>
                      setDefaults((arr) =>
                        arr.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Label (e.g. Bedtime)"
                    className="h-9"
                  />
                  <Input
                    value={d.value}
                    onChange={(e) =>
                      setDefaults((arr) =>
                        arr.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Value (e.g. 10:30 PM)"
                    className="h-9"
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      setDefaults((arr) => arr.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDefaults((arr) => [...arr, { label: "", value: "" }])
                }
              >
                <Plus className="h-4 w-4" /> Add default
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
