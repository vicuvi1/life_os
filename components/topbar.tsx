"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { QuoteTicker } from "@/components/quote-ticker";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useAuth } from "@/components/auth-provider";

export function Topbar({ email }: { email?: string | null }) {
  const { signOut } = useAuth();
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
