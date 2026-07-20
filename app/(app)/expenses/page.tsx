"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings2,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getExpenses,
  getBudget,
  deleteExpense,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_CATEGORY_COLOR,
  monthKey,
  inMonth,
  monthLabel,
  spendByCategory,
  monthStatus,
} from "@/lib/expenses";
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
import type { Budget, Expense } from "@/lib/types";

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
  }>({ open: false, expense: null });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

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

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const defaultDate = isCurrentMonth ? toDateKey(now) : `${mKey}-01`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Expenses</h1>
          <p className="text-muted-foreground">
            Track spending and stay on budget.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Budget settings"
            onClick={() => setBudgetOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          {/* Only show this once expenses already exist — the empty state
              below has its own "Add expense" CTA, so we never show both. */}
          {user && monthExpenses.length > 0 && (
            <Button onClick={() => setExpenseForm({ open: true, expense: null })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
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
            <Button variant="outline" size="sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>
              This month
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label="Next month" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-semibold">
                    {formatAmount(status.spent, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    spent{" "}
                    {status.budget != null && (
                      <>of {formatAmount(status.budget, currency)}</>
                    )}
                  </p>
                </div>
                {status.budget != null && (
                  <Badge variant={status.overBudget ? "destructive" : "success"}>
                    {status.overBudget
                      ? `${formatAmount(-(status.remaining ?? 0), currency)} over`
                      : `${formatAmount(status.remaining ?? 0, currency)} left`}
                  </Badge>
                )}
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
                {isCurrentMonth && (
                  <span>{status.daysRemaining} days left</span>
                )}
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

          {/* By category */}
          {byCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {byCategory.map((c) => {
                  const cap = budget?.byCategory?.[c.category] ?? null;
                  const over = cap != null && c.amount > cap;
                  const pct = cap != null && cap > 0
                    ? Math.min(100, (c.amount / cap) * 100)
                    : status.spent > 0
                      ? (c.amount / status.spent) * 100
                      : 0;
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{EXPENSE_CATEGORY_LABEL[c.category]}</span>
                        <span className={cn("text-muted-foreground", over && "text-destructive")}>
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
                              : EXPENSE_CATEGORY_COLOR[c.category],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Expense list */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {monthExpenses.length} expense
              {monthExpenses.length === 1 ? "" : "s"} this month
            </h2>
            {monthExpenses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No expenses logged</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Add what you spend to see where your money goes and whether
                    you&apos;re on budget.
                  </p>
                  <Button onClick={() => setExpenseForm({ open: true, expense: null })}>
                    <Plus className="h-4 w-4" /> Add expense
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {monthExpenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="h-8 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: EXPENSE_CATEGORY_COLOR[e.category],
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {e.note || EXPENSE_CATEGORY_LABEL[e.category]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {EXPENSE_CATEGORY_LABEL[e.category]} · {e.date}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatAmount(e.amount, currency)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label="Expense actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setExpenseForm({ open: true, expense: e })
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
        title="Delete this expense?"
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
