"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Layers, CalendarDays, Luggage, WashingMachine, BarChart3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/wardrobe/outfits", label: "Outfits", icon: Layers },
  { href: "/wardrobe/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/wardrobe/packing", label: "Packing", icon: Luggage },
  { href: "/wardrobe/laundry", label: "Laundry", icon: WashingMachine },
  { href: "/wardrobe/stats", label: "Statistics", icon: BarChart3 },
];

function isActive(href: string, path: string | null): boolean {
  if (!path) return false;
  // The root tab also owns the item-detail pages (which have no tab of their own).
  if (href === "/wardrobe") return path === "/wardrobe" || path.startsWith("/wardrobe/item");
  return path === href || path.startsWith(`${href}/`);
}

/** Shared horizontal sub-navigation shown at the top of every wardrobe page. */
export function WardrobeNav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
