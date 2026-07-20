"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, GripVertical, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  /** Stable id used to remember the open/closed state. */
  id: string;
  icon: LucideIcon;
  title: string;
  /** Small count/summary shown next to the title (e.g. "3" or "2/8"). */
  count?: string | number;
  /** Right-aligned action (e.g. a "View all" link). Not part of the toggle. */
  action?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  icon: Icon,
  title,
  count,
  action,
  defaultOpen = true,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lifeos:collapse:${id}`);
      if (saved != null) setOpen(saved === "1");
    } catch {
      /* ignore */
    }
  }, [id]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`lifeos:collapse:${id}`, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <Card className={cn("group/section overflow-hidden", className)}>
      <div className="flex items-center gap-1 px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/25 opacity-0 transition-opacity group-hover/section:opacity-100" />
        <button
          onClick={toggle}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
          {count != null && count !== "" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90"
            )}
          />
        </button>
        {action && <div className="ml-1 shrink-0">{action}</div>}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}
