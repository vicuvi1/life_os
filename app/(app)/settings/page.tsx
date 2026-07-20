"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookText, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Signed in as</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">
              Dark mode is the default for early mornings.
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      <NotificationsCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            href="/settings/milestones"
            className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <BookText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Milestones &amp; release notes</p>
                <p className="text-sm text-muted-foreground">
                  What each version does, how it works, and how to use it.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
