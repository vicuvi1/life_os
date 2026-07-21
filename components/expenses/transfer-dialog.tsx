"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowRightLeft } from "lucide-react";
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
import { createExpense, type ExpenseInput } from "@/lib/firebase/db";
import { ACCOUNTS, ACCOUNT_LABEL, TRANSFER_CATEGORY } from "@/lib/expenses";
import { cn } from "@/lib/utils";
import type { AccountKey } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultDate: string;
  onSaved: () => void;
}

/**
 * Move money between accounts (Wallet↔Safe). A transfer is recorded as two linked
 * entries — an expense out of the source and income into the destination — both in
 * the {@link TRANSFER_CATEGORY} so it moves balances without polluting income/spend.
 */
export function TransferDialog({ open, onOpenChange, userId, defaultDate, onSaved }: Props) {
  const [from, setFrom] = useState<AccountKey>("wallet");
  const [to, setTo] = useState<AccountKey>("safe");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFrom("wallet");
    setTo("safe");
    setAmount("");
    setDate(defaultDate);
    setNote("");
    setError(null);
  }, [open, defaultDate]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (from === to) {
      setError("Pick two different accounts.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError(null);
    const rounded = Math.round(amt * 100) / 100;
    const label = note.trim() || `Transfer ${ACCOUNT_LABEL[from]} → ${ACCOUNT_LABEL[to]}`;
    const out: ExpenseInput = {
      kind: "expense",
      amount: rounded,
      account: from,
      category: TRANSFER_CATEGORY,
      note: label,
      date,
    };
    const into: ExpenseInput = {
      kind: "income",
      amount: rounded,
      account: to,
      category: TRANSFER_CATEGORY,
      note: label,
      date,
    };
    try {
      await Promise.all([createExpense(userId, out), createExpense(userId, into)]);
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save the transfer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-sky-500" /> Transfer money
          </DialogTitle>
          <DialogDescription>
            Move money between your accounts. This keeps your net worth the same — it
            doesn&apos;t count as income or spending.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>From</Label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={from}
                onChange={(e) => setFrom(e.target.value as AccountKey)}
              >
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>{ACCOUNT_LABEL[a]}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Swap accounts"
              onClick={swap}
              className="mb-0.5 shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex-1 space-y-2">
              <Label>To</Label>
              <select
                className={cn(
                  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  from === to && "border-destructive"
                )}
                value={to}
                onChange={(e) => setTo(e.target.value as AccountKey)}
              >
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>{ACCOUNT_LABEL[a]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-amount">Amount</Label>
              <Input
                id="t-amount"
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
              <Label htmlFor="t-date">Date</Label>
              <Input
                id="t-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-note">Note (optional)</Label>
            <Input
              id="t-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Move savings"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
