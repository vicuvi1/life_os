"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { folderBackupSupported, lastBackupAt, loadBackupFolder } from "@/lib/backup";
import { runFolderBackup } from "@/lib/use-backup";

const EVERY_MS = 6 * 60 * 60 * 1000; // at most every 6 hours
const DELAY_MS = 20_000; // let the page settle first

/**
 * Quietly saves a fresh copy of your data into the chosen backup folder when
 * the app is opened (if the last copy is more than a few hours old). Does
 * nothing if no folder is set or the browser needs a click to allow it again —
 * Settings shows that state.
 */
export function AutoBackup() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !folderBackupSupported()) return;
    const last = lastBackupAt();
    if (last != null && Date.now() - last < EVERY_MS) return;
    const timer = window.setTimeout(() => {
      void loadBackupFolder()
        .then((dir) => (dir ? runFolderBackup(user.uid, dir, false) : false))
        .catch(() => false);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [user]);
  return null;
}
