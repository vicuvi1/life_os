"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Utensils, Library, Package, ShoppingCart, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/nutrition", label: "Workspace", icon: Utensils },
  { href: "/nutrition/foods", label: "Food Library", icon: Library },
  { href: "/nutrition/pantry", label: "Pantry", icon: Package },
  { href: "/nutrition/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/nutrition/recipes", label: "Recipes", icon: BookOpen },
  { href: "/nutrition/analytics", label: "Analytics", icon: BarChart3 },
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
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
