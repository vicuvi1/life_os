"use client";

import { useRouter } from "next/navigation";
import { LogOut, Plus, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/mobile-nav";
import { QuoteTicker } from "@/components/quote-ticker";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useCommand } from "@/components/command/command-center";
import { useAuth } from "@/components/auth-provider";

export function Topbar({ email }: { email?: string | null }) {
  const { signOut } = useAuth();
  const { openPalette, openCreate } = useCommand();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-gradient-to-b from-card/60 to-card/30 px-4 backdrop-blur-xl md:px-6">
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <MobileNav />
        {email ? <span className="hidden lg:inline">{email}</span> : null}
        <OfflineIndicator />
      </div>
      <QuoteTicker />
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Search (Command-K)"
          className="hidden items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Quick add">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openCreate("task")}>New task</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openCreate("goal")}>New goal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openCreate("habit")}>New habit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Log out"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
