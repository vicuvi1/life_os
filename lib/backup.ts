// Backups of all your data as one JSON file — written automatically into a
// folder you choose (e.g. your Google Drive "Apps/Life OS" folder, when Google
// Drive for desktop is installed) or downloaded by hand.
//
// The serialization half is pure (and unit tested); the folder half uses the
// browser's File System Access API, available in Chrome and Edge on desktop.

export const BACKUP_VERSION = 1;
export const BACKUP_FILE = "life-os-data.json";
export const BACKUP_HISTORY_DIR = "backups";
/** How many dated copies to keep in the history folder. */
export const BACKUP_KEEP = 14;

export type RawDocs = Record<string, { id: string; data: Record<string, unknown> }[]>;

export interface BackupFile {
  app: "life-os";
  version: number;
  exportedAt: string; // ISO timestamp
  collections: RawDocs;
}

/** Marker a Firestore Timestamp is stored as inside a backup file. */
interface TimestampMark {
  __timestamp: number; // epoch ms
}

function isTimestampLike(v: unknown): v is { toMillis: () => number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toMillis?: unknown }).toMillis === "function"
  );
}

function isTimestampMark(v: unknown): v is TimestampMark {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.keys(v).length === 1 &&
    typeof (v as { __timestamp?: unknown }).__timestamp === "number"
  );
}

/** Deep-copy a value into plain JSON, turning Firestore Timestamps into marks. */
export function encodeValue(value: unknown): unknown {
  if (isTimestampLike(value)) return { __timestamp: value.toMillis() } satisfies TimestampMark;
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = encodeValue(v);
    return out;
  }
  return value;
}

/** Reverse of {@link encodeValue}; `makeTimestamp` rebuilds a Firestore Timestamp. */
export function decodeValue(value: unknown, makeTimestamp: (ms: number) => unknown): unknown {
  if (isTimestampMark(value)) return makeTimestamp(value.__timestamp);
  if (Array.isArray(value)) return value.map((v) => decodeValue(v, makeTimestamp));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = decodeValue(v, makeTimestamp);
    return out;
  }
  return value;
}

export function buildBackup(raw: RawDocs, at: Date): BackupFile {
  const collections: RawDocs = {};
  for (const [name, docs] of Object.entries(raw)) {
    collections[name] = docs.map((d) => ({
      id: d.id,
      data: encodeValue(d.data) as Record<string, unknown>,
    }));
  }
  return { app: "life-os", version: BACKUP_VERSION, exportedAt: at.toISOString(), collections };
}

/** Parse and validate a backup file's text. Throws a readable error if it isn't one. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (typeof data !== "object" || data === null) throw new Error("That file isn't a Life OS backup.");
  const d = data as Partial<BackupFile>;
  if (d.app !== "life-os" || typeof d.collections !== "object" || d.collections === null)
    throw new Error("That file isn't a Life OS backup.");
  if (typeof d.version !== "number" || d.version > BACKUP_VERSION)
    throw new Error("That backup was made by a newer version of Life OS.");
  for (const docs of Object.values(d.collections)) {
    if (!Array.isArray(docs) || docs.some((x) => typeof x?.id !== "string" || typeof x?.data !== "object"))
      throw new Error("That backup file is damaged.");
  }
  return d as BackupFile;
}

export function countDocs(file: BackupFile): number {
  return Object.values(file.collections).reduce((n, docs) => n + docs.length, 0);
}

/** Dated history file name, e.g. "life-os-2026-11-26.json". */
export function historyFileName(dateKey: string): string {
  return `life-os-${dateKey}.json`;
}

/** Which history files to delete so only the newest `keep` remain. */
export function historyToPrune(names: string[], keep = BACKUP_KEEP): string[] {
  const dated = names.filter((n) => /^life-os-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  return dated.slice(0, Math.max(0, dated.length - keep));
}

// ---------------------------------------------------------------------------
// Folder access (File System Access API) — Chrome / Edge on desktop only.
// ---------------------------------------------------------------------------
type PermissionMode = { mode: "readwrite" };
type PermissionResult = "granted" | "denied" | "prompt";

/** The parts of a directory handle we use (not all are in TypeScript's DOM types). */
export interface BackupDirHandle {
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<BackupDirHandle>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterableIterator<string>;
  queryPermission(desc: PermissionMode): Promise<PermissionResult>;
  requestPermission(desc: PermissionMode): Promise<PermissionResult>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { mode?: "readwrite"; id?: string }) => Promise<BackupDirHandle>;
};

export function folderBackupSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

/** Ask the user to choose the backup folder. Rejects if they cancel. */
export async function pickBackupFolder(): Promise<BackupDirHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("This browser can't save to a folder.");
  return picker.call(window, { mode: "readwrite", id: "life-os-backup" });
}

const DB_NAME = "lifeos-backup";
const STORE = "handles";
const KEY = "folder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Remember the chosen folder on this device (handles can't go in localStorage). */
export function saveBackupFolder(handle: BackupDirHandle): Promise<IDBValidKey> {
  return idb("readwrite", (s) => s.put(handle, KEY));
}
export async function loadBackupFolder(): Promise<BackupDirHandle | null> {
  try {
    return ((await idb<unknown>("readonly", (s) => s.get(KEY))) as BackupDirHandle | undefined) ?? null;
  } catch {
    return null;
  }
}
export function forgetBackupFolder(): Promise<undefined> {
  return idb("readwrite", (s) => s.delete(KEY));
}

/** Write the latest data file plus today's dated copy, pruning old copies. */
export async function writeBackupToFolder(
  dir: BackupDirHandle,
  file: BackupFile,
  dateKey: string
): Promise<void> {
  const text = JSON.stringify(file, null, 2);
  const write = async (parent: BackupDirHandle, name: string) => {
    const handle = await parent.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  };
  await write(dir, BACKUP_FILE);
  const history = await dir.getDirectoryHandle(BACKUP_HISTORY_DIR, { create: true });
  await write(history, historyFileName(dateKey));
  const names: string[] = [];
  for await (const name of history.keys()) names.push(name);
  for (const old of historyToPrune(names)) {
    try {
      await history.removeEntry(old);
    } catch {
      /* a copy we couldn't delete is harmless */
    }
  }
}

/** Save a backup through the browser's normal download (works everywhere). */
export function downloadBackup(file: BackupFile, dateKey: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = historyFileName(dateKey);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LAST_KEY = "lifeos:backup:last";
export function lastBackupAt(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function markBackupDone(at: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(at));
  } catch {
    /* ignore */
  }
}
