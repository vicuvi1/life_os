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
import { createHabit, type HabitInput } from "@/lib/firebase/db";
import { TEMPLATE_PACKS, type HabitTemplate } from "@/lib/habit-templates";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSaved: () => void;
}

function templateToInput(t: HabitTemplate): HabitInput {
  return {
    title: t.title,
    description: null,
    emoji: t.emoji,
    tags: t.tags,
    frequency: "daily",
    category: t.category,
    color: t.color,
    targetType: t.targetType,
    targetValue: t.targetValue,
    difficulty: t.difficulty,
    archived: false,
  };
}

export function TemplatesDialog({ open, onOpenChange, userId, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function togglePack(packKey: string, count: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = Array.from({ length: count }, (_, i) => `${packKey}:${i}`);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function addSelected() {
    const chosen: HabitTemplate[] = [];
    for (const pack of TEMPLATE_PACKS) {
      pack.habits.forEach((h, i) => {
        if (selected.has(`${pack.key}:${i}`)) chosen.push(h);
      });
    }
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(chosen.map((t) => createHabit(userId, templateToInput(t))));
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            Pick a pack (or individual habits) to add several at once. You can tweak everything afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {TEMPLATE_PACKS.map((pack) => (
            <div key={pack.key} className="rounded-xl border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-lg">{pack.emoji}</span>
                  {pack.name}
                  <span className="text-xs font-normal text-muted-foreground">· {pack.description}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => togglePack(pack.key, pack.habits.length)}>
                  Toggle all
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2">
                {pack.habits.map((h, i) => {
                  const id = `${pack.key}:${i}`;
                  const on = selected.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition",
                        on ? "border-primary/50 bg-primary/5" : "hover:bg-accent"
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${h.color}22` }}>{h.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {h.targetType === "check" ? "Yes/No" : h.targetType === "duration" ? `${h.targetValue} min` : `${h.targetValue}×`} · {h.difficulty}
                        </span>
                      </span>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={addSelected} disabled={saving || selected.size === 0}>
            {saving ? "Adding…" : `Add ${selected.size || ""} habit${selected.size === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
