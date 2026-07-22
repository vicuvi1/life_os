"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Coins,
  Pencil,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCashLegend, setBudgetAccounts } from "@/lib/firebase/db";
import { useToast } from "@/components/ui/toast-provider";
import {
  cashTotal,
  defaultCashLegend,
  makeDenom,
  sortDenoms,
  startingBalanceForTarget,
} from "@/lib/expenses";
import { formatAmount, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Account, CashDenom, Expense } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  legend: CashDenom[];
  accounts: Account[];
  expenses: Expense[];
  currency: Currency;
  onSaved: () => void;
}

export function CashCounterDialog({
  open,
  onOpenChange,
  userId,
  legend,
  accounts,
  expenses,
  currency,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [list, setList] = useState<CashDenom[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [targetAccount, setTargetAccount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setList(sortDenoms(legend));
    setCounts({});
    setEditing(legend.length === 0);
    setTargetAccount(accounts.find((a) => !a.archived)?.id ?? "");
  }, [open, legend, accounts]);

  const total = cashTotal(list, counts);

  function setCount(id: string, n: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.round(n)) }));
  }
  function bump(id: string, delta: number) {
    setCount(id, (counts[id] ?? 0) + delta);
  }

  // --- legend editing ---
  function patch(id: string, next: Partial<CashDenom>) {
    setList((prev) => prev.map((d) => (d.id === id ? { ...d, ...next } : d)));
  }
  function addDenom() {
    setList((prev) => [...prev, makeDenom(prev.length)]);
  }
  function removeDenom(id: string) {
    setList((prev) => prev.filter((d) => d.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setList((prev) => {
      const arr = sortDenoms(prev);
      const i = arr.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((d, k) => ({ ...d, order: k }));
    });
  }
  async function saveLegend() {
    setBusy(true);
    try {
      const cleaned = list.map((d, i) => ({ ...d, order: i }));
      await setCashLegend(userId, cleaned);
      setList(cleaned);
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  async function prefill() {
    setBusy(true);
    try {
      const seed = defaultCashLegend();
      await setCashLegend(userId, seed);
      setList(seed);
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function saveToAccount() {
    if (!targetAccount) return;
    setBusy(true);
    try {
      const updated = accounts.map((a) =>
        a.id === targetAccount
          ? { ...a, startingBalance: startingBalanceForTarget(a, expenses, total) }
          : a
      );
      await setBudgetAccounts(userId, updated);
      const name = accounts.find((a) => a.id === targetAccount)?.name ?? "account";
      toast({
        title: "Balance updated",
        description: `${name} set to ${formatAmount(total, currency)}.`,
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const activeAccts = accounts.filter((a) => !a.archived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" /> Cash counter
          </DialogTitle>
          <DialogDescription>
            Count physical cash by colour, then apply the total to an account.
          </DialogDescription>
        </DialogHeader>

        {/* Running total */}
        <div className="rounded-2xl border bg-muted/40 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total counted</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatAmount(total, currency)}</p>
        </div>

        {list.length === 0 && !editing ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No colour legend yet. Start from an example or build your own.
            </p>
            <div className="flex gap-2">
              <Button onClick={prefill} disabled={busy}>Use example legend</Button>
              <Button variant="outline" onClick={() => { setList([makeDenom(0)]); setEditing(true); }}>
                Build my own
              </Button>
            </div>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              Example: Yellow = 1000, Blue = 2000, Red = 5000, Green = 10000.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {editing ? "Edit legend" : "Count"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (editing ? saveLegend() : setEditing(true))}
                disabled={busy}
              >
                {editing ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" /> Edit legend
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {sortDenoms(list).map((d) =>
                editing ? (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border p-2">
                    <div className="flex flex-col">
                      <button type="button" onClick={() => move(d.id, -1)} aria-label="Move up" className="text-muted-foreground hover:text-foreground">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(d.id, 1)} aria-label="Move down" className="text-muted-foreground hover:text-foreground">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="color"
                      value={d.color}
                      onChange={(e) => patch(d.id, { color: e.target.value })}
                      aria-label="Colour"
                      className="h-8 w-8 shrink-0 cursor-pointer rounded-md border bg-transparent"
                    />
                    <Input
                      value={d.label}
                      onChange={(e) => patch(d.id, { label: e.target.value })}
                      placeholder="Label"
                      className="h-8 flex-1"
                    />
                    <NumberField
                      value={d.value}
                      onCommit={(v) => patch(d.id, { value: v })}
                      min={0}
                      inputClassName="w-20"
                      aria-label="Value"
                    />
                    <button type="button" onClick={() => removeDenom(d.id)} aria-label="Delete" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                    <span className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: d.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.label || "—"}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatAmount(d.value, currency)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bump(d.id, -1)}
                        aria-label={`Remove one ${d.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-accent active:scale-95"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <NumberField
                        value={counts[d.id] ?? 0}
                        onCommit={(v) => setCount(d.id, v)}
                        min={0}
                        decimals={false}
                        inputClassName="w-14 text-center"
                        aria-label={`${d.label} count`}
                      />
                      <button
                        type="button"
                        onClick={() => bump(d.id, 1)}
                        aria-label={`Add one ${d.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-accent active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              )}
              {editing && (
                <Button type="button" variant="outline" onClick={addDenom} className="w-full">
                  <Plus className="h-4 w-4" /> Add denomination
                </Button>
              )}
            </div>

            {!editing && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Select value={targetAccount} onValueChange={setTargetAccount}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={saveToAccount} disabled={busy || !targetAccount || total <= 0}>
                    Save as balance
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Copies the total to the account once — the counter and legend
                  stay separate and never sync to any balance afterward.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCounts({})}
                  className="w-full text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset counts
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
