import {
  LayoutDashboard,
  Target,
  FolderKanban,
  CheckSquare,
  Shirt,
  Flame,
  CalendarClock,
  Moon,
  GlassWater,
  UtensilsCrossed,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  Activity,
  Timer,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Plan",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/routines", label: "Routines", icon: Shirt },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/sessions", label: "Sessions", icon: CalendarClock },
      { href: "/habits", label: "Habits", icon: Flame },
      { href: "/sleep", label: "Sleep", icon: Moon },
      { href: "/nutrition", label: "Nutrition", icon: GlassWater },
      { href: "/meals", label: "Meals", icon: UtensilsCrossed },
      { href: "/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  {
    label: "Review",
    items: [
      { href: "/review", label: "Weekly Review", icon: CalendarCheck },
      { href: "/insights", label: "Insights", icon: BarChart3 },
      { href: "/dependencies", label: "Dependencies", icon: Activity },
      { href: "/time-audit", label: "Time Audit", icon: Timer },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Flattened list of every nav item (kept for any consumer that needs it). */
export const NAV: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  ...NAV_FOOTER,
];
