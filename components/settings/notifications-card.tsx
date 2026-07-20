"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  currentPermission,
  requestNotificationPermission,
  showNotification,
} from "@/lib/notify";

export function NotificationsCard() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  useEffect(() => {
    setPerm(currentPermission());
  }, []);

  async function enable() {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "granted") {
      showNotification("Reminders on 🎉", "You'll see your top nudge here.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reminders</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Browser notifications</p>
          <p className="text-sm text-muted-foreground">
            {perm === "unsupported"
              ? "Not supported in this browser."
              : perm === "granted"
                ? "On — your top reminder shows while the app is open."
                : perm === "denied"
                  ? "Blocked. Enable notifications for this site in your browser settings."
                  : "Get a nudge for what's left to do today."}
          </p>
        </div>
        {perm === "granted" ? (
          <Badge variant="success">Enabled</Badge>
        ) : (
          <Button
            variant="outline"
            onClick={enable}
            disabled={perm === "unsupported" || perm === "denied"}
          >
            Enable
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
