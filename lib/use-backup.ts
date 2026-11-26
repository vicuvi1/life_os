"use client";

import { useCallback, useEffect, useState } from "react";
import { exportBackup } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  folderBackupSupported,
  forgetBackupFolder,
  lastBackupAt,
  loadBackupFolder,
  markBackupDone,
  pickBackupFolder,
  saveBackupFolder,
  writeBackupToFolder,
  type BackupDirHandle,
} from "@/lib/backup";

export type BackupState =
  | "unsupported" // this browser can't write to a folder
  | "none" // no folder chosen yet
  | "needs-permission" // folder chosen, but the browser wants a click to allow it again
  | "ready";

/** Save everything to the chosen folder. Returns false if permission is missing. */
export async function runFolderBackup(
  userId: string,
  dir: BackupDirHandle,
  askPermission: boolean
): Promise<boolean> {
  let perm = await dir.queryPermission({ mode: "readwrite" });
  if (perm !== "granted" && askPermission) perm = await dir.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") return false;
  const file = await exportBackup(userId);
  await writeBackupToFolder(dir, file, toDateKey(new Date()));
  markBackupDone(Date.now());
  return true;
}

/** State + actions for the backup folder, shared by Settings and the auto-backup. */
export function useBackupFolder(userId: string | undefined) {
  const [state, setState] = useState<BackupState>("none");
  const [folder, setFolder] = useState<BackupDirHandle | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLast(lastBackupAt());
    if (!folderBackupSupported()) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    void loadBackupFolder().then(async (dir) => {
      if (cancelled) return;
      if (!dir) return setState("none");
      setFolder(dir);
      try {
        const perm = await dir.queryPermission({ mode: "readwrite" });
        if (!cancelled) setState(perm === "granted" ? "ready" : "needs-permission");
      } catch {
        if (!cancelled) setState("needs-permission");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const backupNow = useCallback(
    async (dir: BackupDirHandle | null = folder) => {
      if (!userId || !dir) return;
      setBusy(true);
      setError(null);
      try {
        const ok = await runFolderBackup(userId, dir, true);
        setState(ok ? "ready" : "needs-permission");
        if (ok) setLast(lastBackupAt());
        else setError("The browser didn't allow writing to that folder.");
      } catch {
        setError("Couldn't write the backup. Is the folder still there?");
      } finally {
        setBusy(false);
      }
    },
    [userId, folder]
  );

  const choose = useCallback(async () => {
    setError(null);
    let dir: BackupDirHandle;
    try {
      dir = await pickBackupFolder();
    } catch {
      return; // cancelled
    }
    await saveBackupFolder(dir);
    setFolder(dir);
    await backupNow(dir);
  }, [backupNow]);

  const forget = useCallback(async () => {
    await forgetBackupFolder();
    setFolder(null);
    setState("none");
  }, []);

  return { state, folder, last, busy, error, choose, backupNow, forget };
}
