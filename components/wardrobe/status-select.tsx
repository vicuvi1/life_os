"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WARDROBE_STATUSES, STATUS_META } from "@/lib/wardrobe";
import { cn } from "@/lib/utils";
import type { WardrobeStatus } from "@/lib/types";

interface Props {
  status: WardrobeStatus;
  needsIroning: boolean;
  onChange: (patch: { status?: WardrobeStatus; needsIroning?: boolean }) => void;
  /** Compact renders just the dot + label chip (for grid cards). */
  compact?: boolean;
  className?: string;
}

/** One-click wash-cycle status changer with the needs-ironing flag. */
export function StatusSelect({ status, needsIroning, onChange, compact, className }: Props) {
  const meta = STATUS_META[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-transparent text-xs font-medium transition hover:border-input hover:bg-accent",
            compact ? "px-1.5 py-0.5" : "px-2.5 py-1",
            className
          )}
          title={meta.hint}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
          <span>{meta.label}</span>
          {needsIroning && <span title="Needs ironing">·👔</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {WARDROBE_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange({ status: s })}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
            {s === status && <span className="ml-auto text-xs text-muted-foreground">current</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange({ needsIroning: !needsIroning })}>
          👔 {needsIroning ? "Ironed (clear flag)" : "Needs ironing"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
