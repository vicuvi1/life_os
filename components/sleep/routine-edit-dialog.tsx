"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
import type { RoutineStep } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: RoutineStep[];
  onSave: (steps: RoutineStep[]) => void;
}

export function RoutineEditDialog({ open, onOpenChange, title, steps, onSave }: Props) {
  const [draft, setDraft] = useState<RoutineStep[]>([]);

  useEffect(() => {
    if (open) setDraft(steps.map((s) => ({ ...s })));
  }, [open, steps]);

  function update(id: string, patch: Partial<RoutineStep>) {
    setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    setDraft((prev) => prev.filter((s) => s.id !== id));
  }
  function add() {
    setDraft((prev) => [...prev, { id: `st-${Date.now()}-${prev.length}`, label: "", time: null }]);
  }

  function save() {
    const cleaned = draft.map((s) => ({ ...s, label: s.label.trim(), time: s.time || null })).filter((s) => s.label);
    onSave(cleaned);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
          <DialogDescription>Add, rename, remove, and time your steps.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {draft.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <Input value={s.label} onChange={(e) => update(s.id, { label: e.target.value })} placeholder="Step name" className="h-9 flex-1" />
              <Input type="time" value={s.time ?? ""} onChange={(e) => update(s.id, { time: e.target.value || null })} className="h-9 w-[110px]" />
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove step" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add} className="w-full">
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
