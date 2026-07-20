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
import { upsertBudget, type BudgetInput } from "@/lib/firebase/db";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/lib/expenses";
import type { Budget, ExpenseCategory } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  budget: Budget | null;
  onSaved: () => void;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  userId,
  budget,
  onSaved,
}: Props) {
  // Currency is managed in Settings → Currency; kept here only so saving the
  // budget preserves the user's existing selection.
  const [currency, setCurrency] = useState("USD");
  const [monthlyTotal, setMonthlyTotal] = useState("");
  const [byCategory, setByCategory] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrency(budget?.currency ?? "USD");
    setMonthlyTotal(budget?.monthlyTotal != null ? String(budget.monthlyTotal) : "");
    const initial: Record<string, string> = {};
    for (const c of EXPENSE_CATEGORIES) {
      const v = budget?.byCategory?.[c];
      initial[c] = v != null ? String(v) : "";
    }
    setByCategory(initial);
  }, [open, budget]);

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cats: Partial<Record<ExpenseCategory, number>> = {};
    for (const c of EXPENSE_CATEGORIES) {
      const n = num(byCategory[c] ?? "");
      if (n != null && n > 0) cats[c] = n;
    }
    const payload: BudgetInput = {
      // Currency is chosen in Settings → Currency; preserve it here.
      currency: currency.trim() || "USD",
      monthlyTotal: num(monthlyTotal),
      byCategory: cats,
    };
    try {
      await upsertBudget(userId, payload);
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
          <DialogTitle>Budget settings</DialogTitle>
          <DialogDescription>
            Set a monthly cap and optional per-category limits. Leave blank to
            skip.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monthly">Monthly total</Label>
            <Input
              id="monthly"
              type="number"
              min={0}
              value={monthlyTotal}
              onChange={(e) => setMonthlyTotal(e.target.value)}
              placeholder="e.g. 400"
            />
            <p className="text-xs text-muted-foreground">
              Display currency is set in Settings → Currency.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Per-category limits (optional)</Label>
            <div className="space-y-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-muted-foreground">
                    {EXPENSE_CATEGORY_LABEL[c]}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={byCategory[c] ?? ""}
                    onChange={(e) =>
                      setByCategory((s) => ({ ...s, [c]: e.target.value }))
                    }
                    placeholder="—"
                    className="h-9"
                  />
                </div>
              ))}
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
              {saving ? "Saving…" : "Save budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
