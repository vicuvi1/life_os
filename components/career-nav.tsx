"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { getCertificationGoals } from "@/lib/firebase/db";
import {
  certStatus,
  certExam,
  certCountLabel,
  sortCertifications,
} from "@/lib/certifications";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Goal } from "@/lib/types";

const COLLAPSE_KEY = "lifeos:careerCollapsed";

function CertCard({ goal }: { goal: Goal }) {
  const status = certStatus(goal);
  const exam = certExam(goal);
  const count = certCountLabel(goal);
  const progress = goal.progress ?? 0;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-lg px-3 py-2 transition-colors hover:bg-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{goal.title}</span>
        <Badge
          variant={status.variant}
          className="shrink-0 px-1.5 py-0 text-[10px] font-semibold"
        >
          {status.label}
        </Badge>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {progress}%{count ? ` · ${count}` : ""}
        </span>
        {exam && (
          <span className="shrink-0">
            {exam.date} · {exam.days >= 0 ? `${exam.days}d` : "overdue"}
          </span>
        )}
      </div>
      <Progress value={progress} className="mt-1.5 h-1.5" />
    </Link>
  );
}

/**
 * "Career" sidebar section listing certifications (goals tagged as
 * certifications) with live progress, exam countdown, and an auto-derived
 * on-track status. Renders nothing until data loads and nothing when the user
 * has no certifications, so it never clutters the nav.
 *
 * `mobile` renders an always-expanded variant (plain header, no persisted
 * collapse) for the mobile menu.
 */
export function CareerNav({ mobile = false }: { mobile?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [certs, setCerts] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setCerts(sortCertifications(await getCertificationGoals(user.uid)));
    } finally {
      setLoaded(true);
    }
  }, [user]);

  // Refetch on mount and on navigation so edits to goals are reflected without
  // a full reload (the app fetches on demand rather than via live listeners).
  useEffect(() => {
    load();
  }, [load, pathname]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Hide the whole section until we know there's something to show.
  if (!loaded || certs.length === 0) return null;

  const list = (
    <div className="space-y-1">
      {certs.map((goal) => (
        <CertCard key={goal.id} goal={goal} />
      ))}
    </div>
  );

  if (mobile) {
    return (
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Career
        </p>
        {list}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      >
        Career
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            collapsed && "-rotate-90"
          )}
        />
      </button>
      {!collapsed && list}
    </div>
  );
}
