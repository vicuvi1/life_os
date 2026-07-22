"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  Star,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ImagePlus,
  X,
} from "lucide-react";
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
import { compressImageToThumbnail } from "@/lib/images";
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

function Avatar({ account, size = 40 }: { account: Account; size?: number }) {
  const color = account.color ?? "#64748b";
  if (account.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={account.image}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: `${color}2e`, color }}
      className="flex shrink-0 items-center justify-center rounded-xl text-lg"
    >
      {account.icon ?? account.name.charAt(0).toUpperCase() ?? "?"}
    </span>
  );
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputs = useRef<Map<string, HTMLInputElement>>(new Map());

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
    if (accountHasHistory(a.id, expenses)) patch(a.id, { archived: true });
    else setList((prev) => prev.filter((x) => x.id !== a.id));
  }
  function setPrimary(id: string) {
    setList((prev) => {
      const cur = prev.find((a) => a.id === id);
      const on = !cur?.isPrimary;
      return prev.map((a) => (a.id === id ? { ...a, isPrimary: on } : { ...a, isPrimary: false }));
    });
  }
  function move(id: string, dir: -1 | 1) {
    setList((prev) => {
      const arr = sortAccounts(prev);
      const i = arr.findIndex((a) => a.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((a, k) => ({ ...a, order: k }));
    });
  }
  async function onUpload(id: string, file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploadingId(id);
    try {
      const url = await compressImageToThumbnail(file);
      patch(id, { image: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't process the image.");
    } finally {
      setUploadingId(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = sortAccounts(list).map((a, i) => ({
        ...a,
        name: a.name.trim() || "Account",
        type: a.type.trim() || "Other",
        order: i,
      }));
      await setBudgetAccounts(userId, cleaned);
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const ordered = sortAccounts(list);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accounts &amp; cards</DialogTitle>
          <DialogDescription>
            Everything is editable any time. Balance = starting balance + this
            account&apos;s income − expenses.
          </DialogDescription>
        </DialogHeader>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="font-medium">No accounts yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Add a card or wallet to start tracking each balance separately.
            </p>
            <Button onClick={addAccount}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {ordered.map((a, i) => {
              const bal = computeAccountBalance(a, expenses);
              const hasHistory = accountHasHistory(a.id, expenses);
              return (
                <div
                  key={a.id}
                  className={cn("space-y-2.5 rounded-xl border p-3", a.archived && "opacity-60")}
                >
                  {/* Header: reorder · avatar · name · balance · actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col text-muted-foreground">
                      <button type="button" onClick={() => move(a.id, -1)} disabled={i === 0} aria-label="Move up" className="disabled:opacity-30 hover:text-foreground">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(a.id, 1)} disabled={i === ordered.length - 1} aria-label="Move down" className="disabled:opacity-30 hover:text-foreground">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Avatar account={a} size={36} />
                    <Input
                      value={a.name}
                      onChange={(e) => patch(a.id, { name: e.target.value })}
                      placeholder="Account name (e.g. Maib Visa)"
                      className="h-9 flex-1 font-medium"
                    />
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      {formatAmount(bal, a.currency ? resolveCurrency({ currency: a.currency }) : currency)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPrimary(a.id)}
                      aria-label={a.isPrimary ? "Unset primary" : "Set as primary"}
                      title="Primary — pre-selected in Quick Add"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                        a.isPrimary ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Star className={cn("h-3.5 w-3.5", a.isPrimary && "fill-current")} />
                      {a.isPrimary ? "Primary" : "Make primary"}
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(a.id, { hideBalance: !a.hideBalance })}
                      aria-label={a.hideBalance ? "Show balance by default" : "Hide balance by default"}
                      title="Hide balance until tapped"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                        a.hideBalance ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {a.hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {a.hideBalance ? "Hidden" : "Hide balance"}
                    </button>
                    <span className="flex-1" />
                    <button
                      type="button"
                      onClick={() => (a.archived ? patch(a.id, { archived: false }) : removeOrArchive(a))}
                      aria-label={a.archived ? "Restore" : hasHistory ? "Archive" : "Delete"}
                      title={a.archived ? "Restore" : hasHistory ? "Archive (keeps history)" : "Delete"}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {a.archived ? <ArchiveRestore className="h-4 w-4" /> : hasHistory ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Type</Label>
                      <Input value={a.type} list="account-types" onChange={(e) => patch(a.id, { type: e.target.value })} className="h-8 w-32" placeholder="e.g. Crypto wallet" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Starting balance</Label>
                      <NumberField value={a.startingBalance} onCommit={(v) => patch(a.id, { startingBalance: v })} inputClassName="w-24" aria-label="Starting balance" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Currency</Label>
                      <Input value={a.currency ?? ""} onChange={(e) => patch(a.id, { currency: e.target.value.trim().toUpperCase() || null })} placeholder={currency.code} className="h-8 w-20" />
                    </div>
                  </div>

                  <Input value={a.description ?? ""} onChange={(e) => patch(a.id, { description: e.target.value || null })} placeholder="Description (optional)" className="h-8 text-sm" />

                  {/* Appearance */}
                  <div className="space-y-2 rounded-lg bg-muted/30 p-2">
                    <div className="flex items-center gap-2">
                      <Avatar account={a} size={32} />
                      <input
                        ref={(el) => { if (el) fileInputs.current.set(a.id, el); else fileInputs.current.delete(a.id); }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => onUpload(a.id, e.target.files?.[0])}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingId === a.id} onClick={() => fileInputs.current.get(a.id)?.click()}>
                        <ImagePlus className="h-3.5 w-3.5" /> {uploadingId === a.id ? "…" : a.image ? "Change logo" : "Upload logo"}
                      </Button>
                      {a.image && (
                        <button type="button" onClick={() => patch(a.id, { image: null })} aria-label="Remove logo" className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {!a.image && (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {ACCOUNT_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => patch(a.id, { color: c })} aria-label={`Color ${c}`} className={cn("h-5 w-5 rounded-full transition-transform hover:scale-110", a.color === c && "ring-2 ring-foreground ring-offset-1 ring-offset-background")} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ACCOUNT_ICONS.map((ic) => (
                            <button key={ic} type="button" onClick={() => patch(a.id, { icon: a.icon === ic ? null : ic })} className={cn("flex h-6 w-6 items-center justify-center rounded-md text-sm transition-colors", a.icon === ic ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-accent")}>{ic}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
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
        )}

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

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
