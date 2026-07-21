import {
  Bot,
  MessageSquare,
  Zap,
  Bell,
  LayoutDashboard,
  Target,
  FolderKanban,
  CheckSquare,
  Shirt,
  WashingMachine,
  Layers,
  Luggage,
  Flame,
  CalendarClock,
  Moon,
  GlassWater,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  Activity,
  Timer,
  Wallet,
  SlidersHorizontal,
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
    label: "Hub",
    items: [
      { href: "/hub", label: "Agent Hub", icon: Bot },
      { href: "/hub/agents", label: "Agents", icon: MessageSquare },
      { href: "/hub/automations", label: "Automations", icon: Zap },
      { href: "/hub/notifications", label: "Notifications", icon: Bell },
    ],
  },
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
      { href: "/expenses", label: "Finance", icon: Wallet },
      { href: "/trackers", label: "Trackers", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Wardrobe",
    items: [
      { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
      { href: "/wardrobe/outfits", label: "Outfits", icon: Layers },
      { href: "/wardrobe/calendar", label: "Outfit Calendar", icon: CalendarDays },
      { href: "/wardrobe/packing", label: "Packing", icon: Luggage },
      { href: "/wardrobe/laundry", label: "Laundry", icon: WashingMachine },
      { href: "/wardrobe/stats", label: "Statistics", icon: BarChart3 },
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
