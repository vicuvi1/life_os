"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Task-oriented — places you go to do something, not database sections.
const TABS = [
  { href: "/nutrition", label: "Today", emoji: "🍽️" },
  { href: "/nutrition/foods", label: "Foods", emoji: "🥫" },
  { href: "/nutrition/pantry", label: "Pantry", emoji: "📦" },
  { href: "/nutrition/shopping", label: "Shopping", emoji: "🛒" },
  { href: "/nutrition/recipes", label: "Recipes", emoji: "📖" },
  { href: "/nutrition/analytics", label: "Insights", emoji: "📊" },
];

export function NutritionNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const active = t.href === "/nutrition" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="text-base leading-none">{t.emoji}</span>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
