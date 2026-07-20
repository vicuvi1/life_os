import type { Expense, ExpenseCategory } from "@/lib/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "food",
  "transport",
  "fitness",
  "entertainment",
  "education",
  "health",
  "other",
];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: "Food",
  transport: "Transport",
  fitness: "Fitness",
  entertainment: "Entertainment",
  education: "Education",
  health: "Health",
  other: "Other",
};

export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: "#f59e0b",
  transport: "#3b82f6",
  fitness: "#ef4444",
  entertainment: "#8b5cf6",
  education: "#10b981",
  health: "#ec4899",
  other: "#64748b",
};

/** Format an amount with the user's currency symbol; hide trailing .00. */
export function formatMoney(amount: number, currency = "$"): string {
  const rounded = Math.round(amount * 100) / 100;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2);
  return `${currency}${str}`;
}

// --- Month helpers -----------------------------------------------------------

/** "YYYY-MM" for a given year and 0-based month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Whether a YYYY-MM-DD date falls in the given YYYY-MM month. */
export function inMonth(dateKey: string, mKey: string): boolean {
  return dateKey.startsWith(mKey);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthLabel(year: number, month: number): string {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[month]} ${year}`;
}

// --- Aggregation -------------------------------------------------------------

/** Round to whole cents to avoid float drift (e.g. 0.1 + 0.2). */
function toCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalSpent(expenses: Expense[]): number {
  return toCents(expenses.reduce((s, e) => s + e.amount, 0));
}

export interface CategorySpend {
  category: ExpenseCategory;
  amount: number;
}

export function spendByCategory(expenses: Expense[]): CategorySpend[] {
  const map = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount: toCents(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthStatus {
  spent: number;
  budget: number | null;
  remaining: number | null; // budget - spent (may be negative)
  pctUsed: number | null; // 0-100+, null if no budget
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  projected: number; // pace-based projection for the full month
  overBudget: boolean;
}

/**
 * Budget status for a month. For the CURRENT month, projection uses the pace so
 * far; for a completed/past month, projection is just the actual spend.
 */
export function monthStatus(
  expenses: Expense[],
  budget: number | null,
  opts: { year: number; month: number; today: Date }
): MonthStatus {
  const spent = totalSpent(expenses);
  const dim = daysInMonth(opts.year, opts.month);

  const isCurrentMonth =
    opts.today.getFullYear() === opts.year &&
    opts.today.getMonth() === opts.month;
  const isPastMonth =
    opts.year < opts.today.getFullYear() ||
    (opts.year === opts.today.getFullYear() &&
      opts.month < opts.today.getMonth());

  const daysElapsed = isCurrentMonth ? opts.today.getDate() : isPastMonth ? dim : 0;
  const daysRemaining = Math.max(0, dim - daysElapsed);

  const projected =
    isCurrentMonth && daysElapsed > 0 ? (spent / daysElapsed) * dim : spent;

  const remaining = budget != null ? budget - spent : null;
  const pctUsed = budget != null && budget > 0 ? (spent / budget) * 100 : null;
  const overBudget = budget != null && spent > budget;

  return {
    spent,
    budget,
    remaining,
    pctUsed,
    daysElapsed,
    daysInMonth: dim,
    daysRemaining,
    projected,
    overBudget,
  };
}
