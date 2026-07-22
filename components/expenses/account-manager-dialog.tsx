"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Archive, ArchiveRestore } from "lucide-react";
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
import { NumberField } from "@/components/ui/number-field";
import { setBudgetAccounts } from "@/lib/firebase/db";
import {
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  ACCOUNT_TYPE_SUGGESTIONS,
  accountHasHistory,
  computeAccountBalance,
  makeAccount,
  sortAccounts,
} from "@/lib/expenses";
import { formatAmount, resolveCurrency, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Account, Expense } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  accounts: Account[];
  expenses: Expense[];
  currency: Currency;
  onSaved: () => void;
}

export function AccountManagerDialog({
  open,
  onOpenChange,
  userId,
  accounts,
  expenses,
  currency,
  onSaved,
}: Props) {
  const [list, setList] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setList(sortAccounts(accounts));
  }, [open, accounts]);

  function patch(id: string, next: Partial<Account>) {
    setList((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)));
  }
  function addAccount() {
    setList((prev) => [...prev, makeAccount(prev.length)]);
  }
  function removeOrArchive(a: Account) {
    if (accountHasHistory(a.id, expenses)) {
      // Preserve history — archive instead of deleting.
      patch(a.id, { archived: true });
    } else {
      setList((prev) => prev.filter((x) => x.id !== a.id));
    }
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = list.map((a, i) => ({
        ...a,
        name: a.name.trim() || "Account",
        order: i,
      }));
      await setBudgetAccounts(userId, cleaned);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accounts</DialogTitle>
          <DialogDescription>
            Cards, wallets and savings. Balance is computed from transactions plus
            a starting balance you can adjust.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {list.map((a) => {
            const bal = computeAccountBalance(a, expenses);
            const hasHistory = accountHasHistory(a.id, expenses);
            return (
              <div
                key={a.id}
                className={cn(
                  "space-y-2.5 rounded-xl border p-3",
                  a.archived && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={a.name}
                    onChange={(e) => patch(a.id, { name: e.target.value })}
                    placeholder="Account name (e.g. Maib Visa)"
                    className="h-9 flex-1 font-medium"
                  />
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {formatAmount(bal, a.currency ? resolveCurrency({ currency: a.currency }) : currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      a.archived ? patch(a.id, { archived: false }) : removeOrArchive(a)
                    }
                    aria-label={a.archived ? "Restore account" : hasHistory ? "Archive account" : "Delete account"}
                    title={a.archived ? "Restore" : hasHistory ? "Archive (keeps history)" : "Delete"}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {a.archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : hasHistory ? (
                      <Archive className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Type</Label>
                    <Input
                      value={a.type}
                      list="account-types"
                      onChange={(e) => patch(a.id, { type: e.target.value })}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Starting balance</Label>
                    <NumberField
                      value={a.startingBalance}
                      onCommit={(v) => patch(a.id, { startingBalance: v })}
                      inputClassName="w-24"
                      aria-label="Starting balance"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Currency</Label>
                    <Input
                      value={a.currency ?? ""}
                      onChange={(e) => patch(a.id, { currency: e.target.value.trim() || null })}
                      placeholder={currency.code}
                      className="h-8 w-20"
                    />
                  </div>
                </div>

                <Input
                  value={a.description ?? ""}
                  onChange={(e) => patch(a.id, { description: e.target.value || null })}
                  placeholder="Description (optional)"
                  className="h-8 text-sm"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  {ACCOUNT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch(a.id, { color: c })}
                      aria-label={`Color ${c}`}
                      className={cn(
                        "h-6 w-6 rounded-full ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                        a.color === c && "ring-2 ring-foreground"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" />
                  {ACCOUNT_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => patch(a.id, { icon: a.icon === ic ? null : ic })}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-sm transition-colors",
                        a.icon === ic ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-accent"
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>

                {a.archived && (
                  <p className="text-[11px] text-muted-foreground">
                    Archived — hidden from selectors, transaction history kept.
                  </p>
                )}
              </div>
            );
          })}
          <datalist id="account-types">
            {ACCOUNT_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <Button type="button" variant="outline" onClick={addAccount} className="w-full">
            <Plus className="h-4 w-4" /> Add account
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save accounts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
