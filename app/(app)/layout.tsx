"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { OWNER_EMAIL } from "@/lib/owner";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { FloatingCalculator } from "@/components/calculator/floating-calculator";
import { CommandProvider } from "@/components/command/command-center";
import { AutoBackup } from "@/components/auto-backup";
import { AccentProvider } from "@/components/accent-provider";
import { ToastProvider } from "@/components/toast/toast-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <CommandProvider>
        <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar email={user.email === OWNER_EMAIL ? null : user.email} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
        </div>
          <FloatingCalculator />
          <AccentProvider />
          <AutoBackup />
        </div>
      </CommandProvider>
    </ToastProvider>
  );
}
