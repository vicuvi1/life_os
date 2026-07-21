"use client";

import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ACCOUNT_LABEL, categoryLabel, categoryColor } from "@/lib/expenses";
import { cn } from "@/lib/utils";
import type { Expense } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Groups of entries that look like duplicates (same date/amount/category/kind). */
  groups: Expense[][];
  format: (amount: number) => string;
  onDelete: (entry: Expense) => void;
}

/** Review look-alike transactions and delete the extras. */
export function DuplicatesDialog({ open, onOpenChange, groups, format, onDelete }: Props) {
  const total = groups.reduce((s, g) => s + g.length, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review possible duplicates</DialogTitle>
          <DialogDescription>
            {groups.length === 0
              ? "No duplicates in the current view."
              : `${total} transactions across ${groups.length} group${groups.length === 1 ? "" : "s"} share the same date, amount, category, and type. Delete any extras.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {groups.map((group, gi) => {
            const sample = group[0];
            return (
              <div key={gi} className="rounded-xl border">
                <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor(sample.category) }} />
                  <span className="font-medium">{categoryLabel(sample.category)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="tabular-nums">{format(sample.amount)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{sample.date}</span>
                  <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    ×{group.length}
                  </span>
                </div>
                <ul className="divide-y">
                  {group.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{entry.note || <span className="text-muted-foreground">No description</span>}</p>
                        <p className="text-xs text-muted-foreground">{ACCOUNT_LABEL[entry.account]}</p>
                      </div>
                      <span className={cn("shrink-0 tabular-nums", entry.kind === "income" ? "text-emerald-500" : "text-rose-500")}>
                        {entry.kind === "income" ? "+" : "−"}{format(entry.amount)}
                      </span>
                      <button
                        onClick={() => onDelete(entry)}
                        aria-label="Delete this entry"
                        className="rounded p-1.5 text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
