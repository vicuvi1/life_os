"use client";

import { useEffect } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** True while reloading would throw away something the user is in the middle of. */
function isBusy(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLElement) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable)
      return true;
  }
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

/**
 * Keeps an open tab (or a home-screen install) on the newest version: when a
 * newer deployment goes live, the page reloads itself the next time it is safe
 * to — never while a field is focused or a dialog is open.
 */
export function VersionWatcher() {
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let stale = false;
    let stopped = false;

    async function check() {
      if (stopped) return;
      if (!stale) {
        try {
          const res = await fetch("/api/version", { cache: "no-store" });
          if (!res.ok) return;
          const data: unknown = await res.json();
          const live =
            typeof data === "object" && data !== null && "buildId" in data
              ? String((data as { buildId: unknown }).buildId)
              : BUILD_ID;
          stale = live !== BUILD_ID && live !== "dev";
        } catch {
          return; // offline — try again later
        }
      }
      if (stale && !stopped && !isBusy()) window.location.reload();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
