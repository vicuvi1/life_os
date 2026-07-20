import type { Expense } from "@/lib/types";
import { ACCOUNT_LABEL, categoryLabel } from "@/lib/expenses";

/** Escape a value for a CSV cell (quote if it contains comma, quote, or newline). */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Turn money entries into a CSV string with income/expense in separate columns
 * (like the "Amount earned" / "Amount invested" columns of the original sheet),
 * plus a signed amount column that Excel can total. Rows are in date order.
 * Amounts are raw numbers (no currency symbol) so spreadsheet math just works.
 */
export function entriesToCsv(entries: Expense[]): string {
  const header = [
    "Date",
    "Type",
    "Account",
    "Category",
    "Description",
    "Income",
    "Expense",
    "Signed amount",
  ];
  const rows = [...entries]
    .sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt
    )
    .map((e) =>
      [
        e.date,
        e.kind === "income" ? "Income" : "Expense",
        ACCOUNT_LABEL[e.account] ?? e.account,
        categoryLabel(e.category),
        e.note ?? "",
        e.kind === "income" ? e.amount : "",
        e.kind === "expense" ? e.amount : "",
        e.kind === "income" ? e.amount : -e.amount,
      ]
        .map(csvCell)
        .join(",")
    );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

/** Trigger a browser download of CSV text (opens directly in Excel). */
export function downloadCsv(filename: string, csv: string): void {
  // Prepend a UTF-8 BOM so Excel reads accented text and symbols correctly.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
