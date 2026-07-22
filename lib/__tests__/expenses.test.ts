import { describe, it, expect } from "vitest";
import {
  totalSpent,
  totalEarned,
  netTotal,
  computeAccountBalance,
  startingBalanceForTarget,
  cashTotal,
  isTransfer,
  inMonth,
  monthKey,
} from "@/lib/expenses";
import type { CashDenom, Expense } from "@/lib/types";

function e(p: Partial<Expense>): Expense {
  return {
    id: "x",
    userId: "u",
    kind: "expense",
    amount: 0,
    category: "food",
    account: "wallet",
    date: "2026-07-01",
    description: null,
    ...p,
  } as Expense;
}

const entries: Expense[] = [
  e({ kind: "income", amount: 100, category: "salary", account: "wallet" }),
  e({ kind: "expense", amount: 30, category: "food", account: "wallet" }),
  // A Wallet→Safe transfer stored as a paired expense-out + income-in.
  e({ kind: "expense", amount: 50, category: "transfer", account: "wallet" }),
  e({ kind: "income", amount: 50, category: "transfer", account: "safe" }),
];

describe("income / expense totals", () => {
  it("exclude internal transfers", () => {
    expect(totalSpent(entries)).toBe(30);
    expect(totalEarned(entries)).toBe(100);
    expect(netTotal(entries)).toBe(70);
  });
});

describe("computeAccountBalance", () => {
  it("counts transfers (they are real movement between accounts)", () => {
    // wallet: 0 + 100 − 30 − 50 = 20
    expect(computeAccountBalance({ id: "wallet", startingBalance: 0 }, entries)).toBe(20);
    // safe: 0 + 50 = 50
    expect(computeAccountBalance({ id: "safe", startingBalance: 0 }, entries)).toBe(50);
  });
});

describe("startingBalanceForTarget", () => {
  it("backs into the opening balance needed to hit a target", () => {
    // wallet net movement (from 0) is +20; to end at 100 you must start at 80
    expect(startingBalanceForTarget({ id: "wallet", startingBalance: 0 }, entries, 100)).toBe(80);
  });
});

describe("isTransfer", () => {
  it("detects the internal transfer category", () => {
    expect(isTransfer({ category: "transfer" })).toBe(true);
    expect(isTransfer({ category: "food" })).toBe(false);
  });
});

describe("cashTotal", () => {
  it("sums each denomination's value times its count", () => {
    const legend: CashDenom[] = [
      { id: "a", color: "", label: "100", value: 100, order: 0 },
      { id: "b", color: "", label: "50", value: 50, order: 1 },
    ];
    expect(cashTotal(legend, { a: 2, b: 3 })).toBe(350);
  });
});

describe("month helpers", () => {
  it("monthKey pads the month", () => {
    expect(monthKey(2026, 6)).toBe("2026-07");
  });
  it("inMonth matches by prefix", () => {
    expect(inMonth("2026-07-15", "2026-07")).toBe(true);
    expect(inMonth("2026-08-01", "2026-07")).toBe(false);
  });
});
