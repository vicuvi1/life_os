"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookText, ChevronRight, Database, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { AIProvidersCard } from "@/components/settings/ai-providers-card";
import { CurrencyCard } from "@/components/settings/currency-card";
import { ProfileNameField } from "@/components/settings/profile-name";
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
        <CardContent className="space-y-4">
          <ProfileNameField />
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-medium">Signed in as</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </div>
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

      <CurrencyCard />

      <NotificationsCard />

      <TelegramCard />

      <AIProvidersCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            href="/settings/notifications"
            className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Notification builder</p>
                <p className="text-sm text-muted-foreground">
                  Customise the wording, timing, and buttons of every Telegram notification.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            href="/settings/storage"
            className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Storage &amp; data</p>
                <p className="text-sm text-muted-foreground">
                  Your data footprint, auto-cleanup of old logs, and data export.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

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
