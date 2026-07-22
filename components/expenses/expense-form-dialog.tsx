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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createExpense, updateExpense, type ExpenseInput } from "@/lib/firebase/db";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABEL,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";
import type { Account, EntryKind, Expense } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultDate: string;
  /** Which kind to preselect when adding (ignored when editing). */
  initialKind?: EntryKind;
  accounts: Account[];
  expense?: Expense | null;
  onSaved: () => void;
}

const DEFAULT_CATEGORY: Record<EntryKind, string> = {
  expense: "food",
  income: "salary",
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
  userId,
  defaultDate,
  initialKind = "expense",
  accounts,
  expense,
  onSaved,
}: Props) {
  const isEdit = Boolean(expense);
  const [kind, setKind] = useState<EntryKind>("expense");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<string>("wallet");
  const [category, setCategory] = useState<string>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const k = expense?.kind ?? initialKind;
    setKind(k);
    setAmount(expense ? String(expense.amount) : "");
    setAccount(expense?.account ?? accounts[0]?.id ?? "wallet");
    setCategory(expense?.category ?? DEFAULT_CATEGORY[k]);
    setNote(expense?.note ?? "");
    setDate(expense?.date ?? defaultDate);
    setError(null);
  }, [open, expense, defaultDate, initialKind]);

  function switchKind(next: EntryKind) {
    setKind(next);
    // Reset the category to the new kind's default so an expense category never
    // lingers on an income entry (or vice-versa).
    setCategory(DEFAULT_CATEGORY[next]);
  }

  const isIncome = kind === "income";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const categoryLabelFor = (c: string) =>
    isIncome
      ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL]
      : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: ExpenseInput = {
      kind,
      amount: Math.round(amt * 100) / 100,
      account,
      category,
      note: note.trim() || null,
      date,
    };
    try {
      if (isEdit && expense) {
        await updateExpense(expense.id, payload);
      } else {
        await createExpense(userId, payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const title = `${isEdit ? "Edit" : "Add"} ${isIncome ? "income" : "expense"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isIncome
              ? "Log money you received and where it went."
              : "Log what you spent and where."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Income / Expense toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["expense", "income"] as EntryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === k
                    ? k === "income"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabelFor(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Description</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isIncome ? "e.g. June salary" : "e.g. Groceries"}
            />
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
              {saving ? "Saving…" : isEdit ? "Save changes" : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
