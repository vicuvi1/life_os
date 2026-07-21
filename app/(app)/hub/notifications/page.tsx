"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, Trash2, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getHubDocs, setNotificationRead, markAllNotificationsRead, clearNotifications } from "@/lib/firebase/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HubNotification } from "@/lib/types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<HubNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      setItems((await getHubDocs(user.uid)).notifications);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unread = useMemo(() => items.filter((n) => !n.read), [items]);

  async function toggleRead(n: HubNotification) {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: !n.read } : x)));
    await setNotificationRead(n.id, !n.read);
  }
  async function markAll() {
    const ids = unread.map((n) => n.id);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    await markAllNotificationsRead(ids);
  }
  async function clearAll() {
    const ids = items.map((n) => n.id);
    setItems([]);
    await clearNotifications(ids);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Bell className="h-6 w-6 text-primary" /> Notifications</h1>
          <p className="text-muted-foreground">Everything your automations surfaced, in one inbox.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAll} disabled={unread.length === 0}><Check className="h-4 w-4" /> Mark all read</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={clearAll} disabled={items.length === 0}><Trash2 className="h-4 w-4" /> Clear all</Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCard lines={6} />
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Inbox zero</p>
          <p className="max-w-sm text-sm text-muted-foreground">When an automation fires, it lands here (and on Telegram if connected).</p>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {items.map((n) => (
            <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read && "bg-primary/5")}>
              <button type="button" onClick={() => toggleRead(n)} aria-label={n.read ? "Mark unread" : "Mark read"} className="mt-1.5">
                <span className={cn("block h-2 w-2 rounded-full", n.read ? "bg-muted-foreground/30" : "bg-primary")} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </div>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{timeAgo(n.createdAt)}</span>
              {n.href && (
                <Link href={n.href} className="shrink-0 pt-0.5 text-muted-foreground/60 transition hover:text-foreground" aria-label="Open module">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
