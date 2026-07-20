import {
  LayoutDashboard,
  Target,
  FolderKanban,
  CheckSquare,
  Flame,
  CalendarCheck,
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
  { href: "/review", label: "Weekly Review", icon: CalendarCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];
