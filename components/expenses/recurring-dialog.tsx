"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
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
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABEL,
  ACCOUNTS,
  ACCOUNT_LABEL,
  categoryLabel,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";
import type { AccountKey, EntryKind, RecurringRule } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: RecurringRule[];
  onSave: (rules: RecurringRule[]) => void;
}

const DEFAULT_CATEGORY: Record<EntryKind, string> = { income: "salary", expense: "food" };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  }
}

/** Manage recurring money rules (add, edit day/amount, toggle auto-post, delete). */
export function RecurringDialog({ open, onOpenChange, rules, onSave }: Props) {
  const [list, setList] = useState<RecurringRule[]>(rules);

  // Draft for the add form.
  const [kind, setKind] = useState<EntryKind>("expense");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<AccountKey>("wallet");
  const [category, setCategory] = useState<string>("food");
  const [note, setNote] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [autopost, setAutopost] = useState(true);

  useEffect(() => {
    if (open) setList(rules);
  }, [open, rules]);

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catLabel = (c: string) =>
    kind === "income"
      ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL] ?? c
      : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c;

  function resetForm() {
    setKind("expense");
    setAmount("");
    setAccount("wallet");
    setCategory("food");
    setNote("");
    setDayOfMonth("1");
    setAutopost(true);
  }

  function addRule() {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return;
    const day = Math.min(31, Math.max(1, Math.round(Number(dayOfMonth) || 1)));
    const rule: RecurringRule = {
      id: newId(),
      kind,
      amount: Math.round(amt * 100) / 100,
      account,
      category,
      note: note.trim() || null,
      dayOfMonth: day,
      autopost,
      active: true,
      lastPostedMonth: null,
    };
    setList((l) => [...l, rule]);
    resetForm();
  }

  function patch(id: string, next: Partial<RecurringRule>) {
    setList((l) => l.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }
  function remove(id: string) {
    setList((l) => l.filter((r) => r.id !== id));
  }

  function save() {
    onSave(list);
    onOpenChange(false);
  }

  const selectCls =
    "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring transactions</DialogTitle>
          <DialogDescription>
            Set up money that repeats every month — salary, rent, subscriptions. Auto-post
            rules add themselves on their day each month; the rest wait for you to post them.
          </DialogDescription>
        </DialogHeader>

        {/* Existing rules */}
        <div className="space-y-2">
          {list.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No recurring rules yet. Add one below.
            </p>
          ) : (
            list.map((r) => (
              <div key={r.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border p-2.5", !r.active && "opacity-50")}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.kind === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500")}>
                  {r.kind === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.note || categoryLabel(r.category)}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(r.category)} · {ACCOUNT_LABEL[r.account]} · day {r.dayOfMonth}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.amount}
                  onChange={(e) => patch(r.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-9 w-24"
                  aria-label="Amount"
                />
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={r.dayOfMonth}
                  onChange={(e) => patch(r.id, { dayOfMonth: Math.min(31, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  className="h-9 w-16"
                  aria-label="Day of month"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={r.autopost} onChange={(e) => patch(r.id, { autopost: e.target.checked })} className="h-4 w-4 rounded border-input" />
                  Auto
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={r.active} onChange={(e) => patch(r.id, { active: e.target.checked })} className="h-4 w-4 rounded border-input" />
                  On
                </label>
                <button onClick={() => remove(r.id)} aria-label="Delete rule" className="rounded p-1.5 text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a rule</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select className={selectCls} value={kind} onChange={(e) => { const k = e.target.value as EntryKind; setKind(k); setCategory(DEFAULT_CATEGORY[k]); }}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
            <select className={selectCls} value={account} onChange={(e) => setAccount(e.target.value as AccountKey)}>
              {ACCOUNTS.map((a) => <option key={a} value={a}>{ACCOUNT_LABEL[a]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Day</Label>
              <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rent" className="h-9" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={autopost} onChange={(e) => setAutopost(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Auto-post each month
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={addRule}>
              <Plus className="h-4 w-4" /> Add rule
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
