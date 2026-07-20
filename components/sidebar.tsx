"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, NAV_FOOTER } from "@/lib/nav";
import { useAuth } from "@/components/auth-provider";
import { resolveFirstName } from "@/lib/greeting";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, displayName } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lifeos:navCollapsed");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSection(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem("lifeos:navCollapsed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/30 md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">Life OS</p>
          <p className="text-[11px] text-muted-foreground">Run your day</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsed[section.label];
          return (
            <div key={section.label} className="space-y-1">
              <button
                onClick={() => toggleSection(section.label)}
                className="flex w-full items-center gap-1 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                {section.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isCollapsed && "-rotate-90"
                  )}
                />
              </button>
              {!isCollapsed &&
                section.items.map((item) => (
                  <NavLink key={item.href} {...item} active={isActive(item.href)} />
                ))}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t p-3">
        {NAV_FOOTER.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
        {user && (
          <div className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {resolveFirstName(displayName, user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">
                {resolveFirstName(displayName, user.email)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
