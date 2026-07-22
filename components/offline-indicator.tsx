"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

/**
 * Shows an "Offline" badge when the browser loses connectivity. Paired with the
 * Firestore persistent cache: reads still come from local storage and writes are
 * queued and synced automatically once you're back online.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300"
      title="You're offline — changes are saved locally and sync automatically when you reconnect."
    >
      <CloudOff className="h-3.5 w-3.5" /> Offline
    </span>
  );
}
