"use client";

import { Check, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoutineStep } from "@/lib/types";

interface Props {
  title: string;
  icon: React.ReactNode;
  steps: RoutineStep[];
  done: string[];
  onToggle: (id: string) => void;
  onEdit: () => void;
}

/** An evening/morning routine checklist with per-day completion. */
export function RoutineCard({ title, icon, steps, done, onToggle, onEdit }: Props) {
  const doneSet = new Set(done);
  const completed = steps.filter((s) => doneSet.has(s.id)).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icon} {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{completed}/{steps.length}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Edit routine" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        {steps.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No steps yet — tap edit to add some.</p>
        ) : (
          steps.map((s) => {
            const on = doneSet.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent"
              >
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-input")}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", on && "text-muted-foreground line-through")}>{s.label}</span>
                {s.time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.time}</span>}
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
