"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FolderOpen, HardDriveDownload, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/components/auth-provider";
import { exportBackup, restoreBackup } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { BACKUP_FILE, countDocs, downloadBackup, parseBackup, type BackupFile } from "@/lib/backup";
import { useBackupFolder } from "@/lib/use-backup";

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Settings: keep a copy of all your data in a folder you choose. */
export function BackupCard() {
  const { user } = useAuth();
  const backup = useBackupFolder(user?.uid);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function download() {
    if (!user) return;
    setWorking(true);
    setMessage(null);
    try {
      downloadBackup(await exportBackup(user.uid), toDateKey(new Date()));
    } catch {
      setMessage({ tone: "error", text: "Couldn't create the backup. Try again." });
    } finally {
      setWorking(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't read that file." });
    }
  }

  async function restore() {
    if (!user || !pending) return;
    setWorking(true);
    try {
      const n = await restoreBackup(user.uid, pending);
      setMessage({ tone: "ok", text: `Restored ${n} items. Reload the page to see them.` });
    } catch {
      setMessage({ tone: "error", text: "Restore failed part-way. Nothing was deleted; try again." });
    } finally {
      setWorking(false);
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDriveDownload className="h-4 w-4 text-muted-foreground" /> Backup folder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Life OS keeps a copy of everything in one file, <code>{BACKUP_FILE}</code>, plus dated
          copies of the last two weeks. Choose your Google Drive folder (for example{" "}
          <strong>My Drive › Apps › Life OS</strong>) and the copy syncs to Drive on its own.
        </p>

        {backup.state === "unsupported" ? (
          <p className="flex items-start gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            This browser can&apos;t save into a folder by itself (that needs Chrome or Edge on a
            computer). Use Download below and put the file where you want it.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-[10rem] flex-1 text-sm">
              <p className="font-medium">
                {backup.folder ? `Folder: ${backup.folder.name}` : "No folder chosen"}
              </p>
              <p className="text-muted-foreground">
                {backup.state === "needs-permission"
                  ? "The browser needs your OK again before it can write here."
                  : backup.last
                    ? `Last saved ${ago(backup.last)}. Saved again each time you open the app.`
                    : backup.folder
                      ? "Not saved yet."
                      : "Pick it once; after that backups are automatic on this computer."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {backup.folder && (
                <Button size="sm" onClick={() => void backup.backupNow()} disabled={backup.busy}>
                  {backup.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {backup.state === "needs-permission" ? "Allow and back up" : "Back up now"}
                </Button>
              )}
              <Button
                size="sm"
                variant={backup.folder ? "outline" : "default"}
                onClick={() => void backup.choose()}
                disabled={backup.busy}
              >
                <FolderOpen className="h-4 w-4" />
                {backup.folder ? "Change folder" : "Choose folder"}
              </Button>
              {backup.folder && (
                <Button size="sm" variant="ghost" onClick={() => void backup.forget()}>
                  Stop
                </Button>
              )}
            </div>
          </div>
        )}
        {backup.error && (
          <p className="text-sm text-destructive" role="alert">
            {backup.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => void download()} disabled={working}>
            <Download className="h-4 w-4" /> Download a backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={working}>
            <Upload className="h-4 w-4" /> Restore from a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onFile(e)}
            aria-label="Backup file to restore"
          />
        </div>
        {message && (
          <p
            className={message.tone === "ok" ? "text-sm text-emerald-500" : "text-sm text-destructive"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={pending != null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Restore this backup?"
        description={
          pending
            ? `${countDocs(pending)} items saved on ${new Date(pending.exportedAt).toLocaleString()} will be written back. Items changed since then are overwritten with the backup's version; nothing is deleted.`
            : undefined
        }
        confirmLabel="Restore"
        onConfirm={restore}
      />
    </Card>
  );
}
