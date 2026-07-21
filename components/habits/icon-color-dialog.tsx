"use client";

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
import { EMOJI_PRESETS, HABIT_COLORS, DEFAULT_HABIT_COLOR } from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  onApply: (patch: { emoji?: string | null; color?: string }) => void;
}

/** Quick editor to change a habit's emoji + color inline (applies immediately). */
export function IconColorDialog({ open, onOpenChange, habit, onApply }: Props) {
  const color = habit?.color ?? DEFAULT_HABIT_COLOR;
  const emoji = habit?.emoji ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: `${color}22` }}>
              {emoji || <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
            </span>
            {habit?.title ?? "Habit"}
          </DialogTitle>
          <DialogDescription>Pick an emoji and color — changes apply instantly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Emoji</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Emoji"
                value={emoji}
                onChange={(e) => onApply({ emoji: [...e.target.value].slice(-2).join("") || null })}
                placeholder="🙂"
                className="w-14 text-center text-lg"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => onApply({ emoji: null })}>
                No emoji (color dot)
              </Button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border bg-muted/20 p-1.5">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onApply({ emoji: e })}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded text-base transition hover:bg-accent",
                    emoji === e && "bg-accent ring-1 ring-ring"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.name}
                  onClick={() => onApply({ color: c.value })}
                  className={cn(
                    "h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition",
                    color === c.value && "ring-2 ring-ring"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <label className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-input" title="Custom color" style={{ backgroundColor: color }}>
                <input type="color" value={color} onChange={(e) => onApply({ color: e.target.value })} className="h-10 w-10 cursor-pointer opacity-0" aria-label="Custom color" />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
