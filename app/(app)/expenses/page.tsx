"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Plus,
  ChevronLeft,
  ChevronRight,
  Settings2,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  List,
  Table2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getExpenses, getBudget, deleteExpense } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  categoryLabel,
  categoryColor,
  monthKey,
  inMonth,
  monthLabel,
  spendByCategory,
  monthStatus,
  totalEarned,
  totalSpent,
  netTotal,
  accountBalance,
  withRunningBalance,
  ACCOUNTS,
  ACCOUNT_LABEL,
} from "@/lib/expenses";
import { entriesToCsv, downloadCsv } from "@/lib/export";
import { resolveCurrency, formatAmount } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { BudgetFormDialog } from "@/components/expenses/budget-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Budget, EntryKind, Expense } from "@/lib/types";

type SortKey = "date" | "amount" | "category" | "account" | "kind";

function StatTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "up" && "text-emerald-600 dark:text-emerald-400",
            tone === "down" && "text-destructive"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  const [expenseForm, setExpenseForm] = useState<{
    open: boolean;
    expense: Expense | null;
    kind: EntryKind;
  }>({ open: false, expense: null, kind: "expense" });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const [view, setView] = useState<"list" | "table">("list");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ex, bg] = await Promise.all([
        getExpenses(user.uid),
        getBudget(user.uid),
      ]);
      setExpenses(ex);
      setBudget(bg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = resolveCurrency(budget);
  const mKey = monthKey(year, month);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => inMonth(e.date, mKey)),
    [expenses, mKey]
  );

  const earned = useMemo(() => totalEarned(monthExpenses), [monthExpenses]);
  const spent = useMemo(() => totalSpent(monthExpenses), [monthExpenses]);
  const net = useMemo(() => netTotal(monthExpenses), [monthExpenses]);

  const status = useMemo(
    () =>
      monthStatus(monthExpenses, budget?.monthlyTotal ?? null, {
        year,
        month,
        today: new Date(),
      }),
    [monthExpenses, budget, year, month]
  );

  const byCategory = useMemo(
    () => spendByCategory(monthExpenses),
    [monthExpenses]
  );

  // Account balances use ALL entries (not just this month) for a true current
  // balance, seeded by each account's opening balance.
  const accounts = useMemo(
    () =>
      ACCOUNTS.map((a) => ({
        key: a,
        balance: accountBalance(
          expenses,
          a,
          budget?.openingBalances?.[a] ?? 0
        ),
      })),
    [expenses, budget]
  );
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  const rows = useMemo(() => {
    const withBal = withRunningBalance(monthExpenses);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...withBal].sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "date":
          cmp =
            a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "category":
          cmp = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
          break;
        case "account":
          cmp = a.account.localeCompare(b.account);
          break;
        case "kind":
          cmp = a.kind.localeCompare(b.kind);
          break;
      }
      return cmp * dir;
    });
  }, [monthExpenses, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" ? "desc" : "asc" }
    );
  }

  function exportCsv(scope: "month" | "all") {
    const data = scope === "month" ? monthExpenses : expenses;
    if (data.length === 0) return;
    const name = scope === "month" ? `finance-${mKey}.csv` : "finance-all.csv";
    downloadCsv(name, entriesToCsv(data));
  }

  function openAdd(kind: EntryKind) {
    setExpenseForm({ open: true, expense: null, kind });
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const defaultDate = isCurrentMonth ? toDateKey(now) : `${mKey}-01`;
  const hasBudget = budget?.monthlyTotal != null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Finance</h1>
          <p className="text-muted-foreground">
            Track income, spending, and your balances.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("month")}>
                This month (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("all")}>
                All time (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            aria-label="Budget & accounts settings"
            onClick={() => setBudgetOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openAdd("expense")}>
                <TrendingDown className="h-4 w-4" /> Add expense
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("income")}>
                <TrendingUp className="h-4 w-4" /> Add income
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">{monthLabel(year, month)}</p>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
            >
              This month
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label="Next month" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : (
        <>
          {/* Earned / Spent / Net — this month */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="Earned"
              value={formatAmount(earned, currency)}
              tone="up"
              icon={TrendingUp}
            />
            <StatTile
              label="Spent"
              value={formatAmount(spent, currency)}
              tone="down"
              icon={TrendingDown}
            />
            <StatTile
              label="Net"
              value={formatAmount(net, currency)}
              tone={net >= 0 ? "up" : "down"}
              icon={Wallet}
            />
          </div>

          {/* Account balances */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Accounts</CardTitle>
              <span className="text-sm text-muted-foreground">
                Total{" "}
                <span className="font-semibold text-foreground">
                  {formatAmount(netWorth, currency)}
                </span>
              </span>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {accounts.map((a) => (
                <div
                  key={a.key}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {a.key === "safe" ? (
                      <PiggyBank className="h-4 w-4" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {ACCOUNT_LABEL[a.key]}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        a.balance < 0 && "text-destructive"
                      )}
                    >
                      {formatAmount(a.balance, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Budget (only if a monthly cap is set) */}
          {hasBudget && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Spent {formatAmount(status.spent, currency)} of{" "}
                      {formatAmount(status.budget ?? 0, currency)}
                    </p>
                  </div>
                  <Badge variant={status.overBudget ? "destructive" : "success"}>
                    {status.overBudget
                      ? `${formatAmount(-(status.remaining ?? 0), currency)} over`
                      : `${formatAmount(status.remaining ?? 0, currency)} left`}
                  </Badge>
                </div>

                {status.pctUsed != null && (
                  <Progress
                    value={Math.min(100, status.pctUsed)}
                    indicatorClassName={
                      status.overBudget
                        ? "bg-destructive"
                        : status.pctUsed > 85
                          ? "bg-amber-500"
                          : undefined
                    }
                  />
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  {isCurrentMonth && <span>{status.daysRemaining} days left</span>}
                  {isCurrentMonth && status.daysElapsed > 0 && (
                    <span>
                      Projected: {formatAmount(status.projected, currency)}
                      {status.budget != null &&
                        status.projected > status.budget &&
                        " ⚠️"}
                    </span>
                  )}
                </div>

                {status.overBudget && (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    You&apos;re over budget this month by{" "}
                    {formatAmount(-(status.remaining ?? 0), currency)}.
                  </div>
                )}
                {!status.overBudget &&
                  isCurrentMonth &&
                  status.budget != null &&
                  status.projected > status.budget && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      At this pace you&apos;ll finish around{" "}
                      {formatAmount(status.projected, currency)} — over your{" "}
                      {formatAmount(status.budget, currency)} budget.
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* By category */}
          {byCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {byCategory.map((c) => {
                  const cap = budget?.byCategory?.[c.category] ?? null;
                  const over = cap != null && c.amount > cap;
                  const pct =
                    cap != null && cap > 0
                      ? Math.min(100, (c.amount / cap) * 100)
                      : spent > 0
                        ? (c.amount / spent) * 100
                        : 0;
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{categoryLabel(c.category)}</span>
                        <span
                          className={cn(
                            "text-muted-foreground",
                            over && "text-destructive"
                          )}
                        >
                          {formatAmount(c.amount, currency)}
                          {cap != null && ` / ${formatAmount(cap, currency)}`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(pct)}%`,
                            backgroundColor: over
                              ? "hsl(var(--destructive))"
                              : categoryColor(c.category),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Entries */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {monthExpenses.length}{" "}
                {monthExpenses.length === 1 ? "entry" : "entries"} this month
              </h2>
              {monthExpenses.length > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                  <button
                    onClick={() => setView("list")}
                    aria-label="List view"
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      view === "list"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setView("table")}
                    aria-label="Table view"
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      view === "table"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Table2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {monthExpenses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Nothing logged yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Add income and expenses to see your net, balances, and where
                    your money goes.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => openAdd("expense")}>
                      <Plus className="h-4 w-4" /> Add expense
                    </Button>
                    <Button variant="outline" onClick={() => openAdd("income")}>
                      <Plus className="h-4 w-4" /> Add income
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : view === "table" ? (
              <TableView
                rows={rows}
                currency={currency}
                sort={sort}
                onSort={toggleSort}
                onEdit={(e) =>
                  setExpenseForm({ open: true, expense: e, kind: e.kind })
                }
                onDelete={(e) => setDeleting(e)}
              />
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {rows.map((e) => (
                    <div
                      key={e.id}
                      className="animate-fade-slide-in flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="h-8 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: categoryColor(e.category) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {e.note || categoryLabel(e.category)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabel(e.category)} · {ACCOUNT_LABEL[e.account]}{" "}
                          · {e.date}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          e.kind === "income"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        )}
                      >
                        {e.kind === "income" ? "+" : "−"}
                        {formatAmount(e.amount, currency)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label="Entry actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setExpenseForm({
                                open: true,
                                expense: e,
                                kind: e.kind,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(e)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}

      {user && (
        <>
          <ExpenseFormDialog
            open={expenseForm.open}
            onOpenChange={(o) => setExpenseForm((s) => ({ ...s, open: o }))}
            userId={user.uid}
            defaultDate={defaultDate}
            initialKind={expenseForm.kind}
            expense={expenseForm.expense}
            onSaved={load}
          />
          <BudgetFormDialog
            open={budgetOpen}
            onOpenChange={setBudgetOpen}
            userId={user.uid}
            budget={budget}
            onSaved={load}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        onConfirm={async () => {
          if (deleting) {
            await deleteExpense(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable table view
// ---------------------------------------------------------------------------
function SortHeader({
  label,
  col,
  sort,
  onSort,
  className,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === col;
  return (
    <th className={cn("px-3 py-2 font-medium", className)}>
      <button
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

function TableView({
  rows,
  currency,
  sort,
  onSort,
  onEdit,
  onDelete,
}: {
  rows: (Expense & { balance: number })[];
  currency: ReturnType<typeof resolveCurrency>;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs">
              <SortHeader label="Date" col="date" sort={sort} onSort={onSort} />
              <SortHeader label="Type" col="kind" sort={sort} onSort={onSort} />
              <SortHeader
                label="Account"
                col="account"
                sort={sort}
                onSort={onSort}
              />
              <SortHeader
                label="Category"
                col="category"
                sort={sort}
                onSort={onSort}
              />
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Description
              </th>
              <SortHeader
                label="Amount"
                col="amount"
                sort={sort}
                onSort={onSort}
                className="text-right"
              />
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Running net
              </th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-accent/40">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {e.date}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={e.kind === "income" ? "success" : "secondary"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {e.kind === "income" ? "Income" : "Expense"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {ACCOUNT_LABEL[e.account]}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(e.category) }}
                    />
                    {categoryLabel(e.category)}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                  {e.note || "—"}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums",
                    e.kind === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  )}
                >
                  {e.kind === "income" ? "+" : "−"}
                  {formatAmount(e.amount, currency)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground",
                    e.balance < 0 && "text-destructive"
                  )}
                >
                  {formatAmount(e.balance, currency)}
                </td>
                <td className="px-2 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Entry actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(e)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(e)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
