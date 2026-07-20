import {
  LayoutDashboard,
  Target,
  FolderKanban,
  CheckSquare,
  Flame,
  CalendarClock,
  Moon,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/sessions", label: "Sessions", icon: CalendarClock },
  { href: "/sleep", label: "Sleep", icon: Moon },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/review", label: "Weekly Review", icon: CalendarCheck },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
