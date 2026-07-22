"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, CheckSquare, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, NAV_FOOTER, SUBNAV, type SubNavItem } from "@/lib/nav";
import { useAuth } from "@/components/auth-provider";
import { greetingFor, resolveFirstName, toDateKey } from "@/lib/greeting";
import { formatLongDate } from "@/lib/dates";
import { getTasks, getDailyHabits, getHabitLogs } from "@/lib/firebase/db";
import { Logo } from "@/components/logo";
import { CareerNav } from "@/components/career-nav";
import type { Task, Habit, HabitLog } from "@/lib/types";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const EMPTY_SUB: SubNavItem[] = [];

export function Sidebar() {
  const pathname = usePathname();
  const { user, displayName } = useAuth();
  const today = toDateKey(new Date());

  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);

  // Persisted collapse (pinned) state
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("lifeos:navCollapsed") === "1");
    } catch { /* ignore */ }
  }, []);
  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("lifeos:navCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
    setHovered(false);
  }, []);

  // "Today" widget data
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getTasks(user.uid), getDailyHabits(user.uid), getHabitLogs(user.uid)])
      .then(([t, h, l]) => { if (!cancelled) { setTasks(t); setHabits(h); setHabitLogs(l); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, pathname]);

  const doneToday = useMemo(() => new Set(habitLogs.filter((l) => l.completedDate === today).map((l) => l.habitId)), [habitLogs, today]);
  const habitsLeft = habits.filter((h) => !doneToday.has(h.id)).length;
  const habitsDone = habits.length - habitsLeft;
  const tasksLeft = tasks.filter((t) => t.status !== "done" && (!t.dueDate || t.dueDate <= today)).length;
  const progress = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;

  // Active route (most-specific match wins)
  const subKey = Object.keys(SUBNAV).find((k) => pathname === k || pathname.startsWith(`${k}/`));
  const subItems = subKey ? SUBNAV[subKey] : EMPTY_SUB;
  const allHrefs = useMemo(() => [
    ...NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href)),
    ...subItems.map((s) => s.href),
    ...NAV_FOOTER.map((i) => i.href),
  ], [subItems]);
  const activeHref = useMemo(() => {
    const matches = allHrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
    return matches.sort((a, b) => b.length - a.length)[0] ?? "";
  }, [allHrefs, pathname]);
  // In the collapsed rail, sub-items aren't rendered — pin the pill to the module icon.
  const pillHref = !expanded && subKey ? subKey : activeHref;

  // Sliding pill indicator
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [pill, setPill] = useState<{ top: number; height: number; visible: boolean }>({ top: 0, height: 0, visible: false });

  const measure = useCallback(() => {
    const nav = navRef.current;
    const el = itemRefs.current.get(pillHref);
    if (!nav || !el) { setPill((p) => ({ ...p, visible: false })); return; }
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setPill({ top: box.top - navBox.top + nav.scrollTop, height: box.height, visible: true });
  }, [pillHref]);

  useLayoutEffect(() => { measure(); }, [measure, expanded, subItems.length, pathname]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  const setItemRef = (href: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(href, el);
    else itemRefs.current.delete(href);
  };

  const name = resolveFirstName(displayName, user?.email);

  return (
    <aside
      className="relative hidden h-full shrink-0 md:block"
      style={{ width: collapsed ? 76 : 248, transition: `width 220ms ${EASE}` }}
    >
      <div
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-border/40",
          "bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl",
          collapsed && hovered && "shadow-2xl shadow-black/40"
        )}
        style={{ width: expanded ? 248 : 76, transition: `width 220ms ${EASE}` }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
          <Logo size={34} className="shrink-0 shadow-sm" />
          <div className={cn("min-w-0 flex-1 leading-tight transition-opacity duration-150", expanded ? "opacity-100" : "pointer-events-none opacity-0")}>
            <p className="truncate text-[15px] font-semibold tracking-tight">Life OS</p>
            <p className="truncate text-[11px] text-muted-foreground">Run your day</p>
          </div>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground", !expanded && "pointer-events-none opacity-0")}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Today widget */}
        {expanded && (
          <div className="mx-3 mb-1 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3.5">
            <p className="text-sm font-semibold leading-tight">{greetingFor(new Date().getHours())}, {name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatLongDate(today)}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Today&apos;s progress</span>
                <span className="font-semibold tabular-nums">{progress}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%`, transition: `width 400ms ${EASE}` }} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat icon={<CheckSquare className="h-3.5 w-3.5" />} value={tasksLeft} label={tasksLeft === 1 ? "task left" : "tasks left"} />
              <MiniStat icon={<Flame className="h-3.5 w-3.5" />} value={habitsLeft} label={habitsLeft === 1 ? "habit left" : "habits left"} />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav ref={navRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          {/* Sliding active pill */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 right-3 z-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20"
            style={{ top: 0, height: pill.height, transform: `translateY(${pill.top}px)`, opacity: pill.visible ? 1 : 0, transition: `transform 240ms ${EASE}, height 240ms ${EASE}, opacity 150ms linear` }}
          />
          <div className="relative z-10 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="space-y-0.5">
                {expanded ? (
                  <p className="mb-1 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: section.accent }} />
                    {section.label}
                  </p>
                ) : (
                  <div className="mx-3 mb-1 h-px" style={{ backgroundColor: `${section.accent}55` }} />
                )}
                {section.items.map((item) => {
                  const isSectionActive = SUBNAV[item.href] && pathname.startsWith(item.href);
                  return (
                    <div key={item.href}>
                      <SideLink innerRef={setItemRef(item.href)} href={item.href} label={item.label} Icon={item.icon} accent={section.accent} active={activeHref === item.href || (!expanded && !!isSectionActive)} sectionActive={!!isSectionActive} expanded={expanded} />
                      {isSectionActive && expanded && subItems.length > 0 && (
                        <div className="mb-1 ml-[26px] mt-0.5 space-y-0.5 border-l border-border/40 pl-2">
                          {subItems.map((s) => (
                            <Link key={s.href} ref={setItemRef(s.href)} href={s.href} className={cn("block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors", activeHref === s.href ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
                              {s.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {expanded && <CareerNav />}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-border/40 px-3 py-3">
          {NAV_FOOTER.map((item) => (
            <SideLink key={item.href} href={item.href} label={item.label} Icon={item.icon} active={activeHref === item.href} sectionActive={false} expanded={expanded} activeBg />
          ))}
          {user && (
            <div className="mt-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/20">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className={cn("min-w-0 leading-tight transition-opacity duration-150", expanded ? "opacity-100" : "pointer-events-none opacity-0")}>
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SideLink({ href, label, Icon, active, sectionActive, expanded, innerRef, activeBg, accent }: {
  href: string; label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; active: boolean; sectionActive: boolean; expanded: boolean; innerRef?: (el: HTMLElement | null) => void; activeBg?: boolean; accent?: string;
}) {
  return (
    <Link
      ref={innerRef}
      href={href}
      title={!expanded ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
        active ? "text-primary" : sectionActive ? "text-foreground hover:bg-accent/60" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        active && activeBg && "bg-primary/10 ring-1 ring-inset ring-primary/20",
        !expanded && "justify-center px-0"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110", active && "scale-105")}
        // Section-tinted icon when idle; the active item keeps the primary color.
        style={!active && accent ? { color: accent } : undefined}
      />
      <span className={cn("truncate transition-all duration-150", expanded ? "opacity-100" : "w-0 opacity-0")}>{label}</span>
    </Link>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-2.5 py-2">
      <p className="flex items-center gap-1 text-lg font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><span className="text-muted-foreground/70">{icon}</span> {label}</p>
    </div>
  );
}
