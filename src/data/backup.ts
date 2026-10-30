import { exportDB, importInto, peakImportFile } from 'dexie-export-import';
import { db as defaultDb, DB_VERSION, type WardrobeDB } from './db';
import { isSecretKey, setSetting } from './settings';

export class BackupError extends Error {}

export interface BackupSummary {
  version: number;
  exportedAt?: number;
  tables: { name: string; rowCount: number }[];
}

const notSecret = (table: string, value: any) => !(table === 'settings' && isSecretKey(String(value?.key ?? '')));

/** Exports every table (photos included). API keys are left out. */
export async function createBackup(db: WardrobeDB = defaultDb): Promise<Blob> {
  return exportDB(db, { filter: notSecret, prettyJson: false });
}

export async function inspectBackup(blob: Blob): Promise<BackupSummary> {
  let meta: Awaited<ReturnType<typeof peakImportFile>>;
  try {
    meta = await peakImportFile(blob);
  } catch {
    throw new BackupError('This file is not a wardrobe backup.');
  }
  if (meta.formatName !== 'dexie' || !meta.data?.tables?.some((t) => t.name === 'items')) {
    throw new BackupError('This file is not a wardrobe backup.');
  }
  if (meta.data.databaseVersion > DB_VERSION) {
    throw new BackupError('This backup comes from a newer version of the app. Update the app, then restore.');
  }
  return {
    version: meta.data.databaseVersion,
    tables: meta.data.tables.map((t) => ({ name: t.name, rowCount: t.rowCount })),
  };
}

/** Replaces all data with the backup. Keys saved on this phone are kept. */
export async function restoreBackup(blob: Blob, db: WardrobeDB = defaultDb): Promise<void> {
  await inspectBackup(blob);
  const secrets = await db.settings.filter((r) => isSecretKey(r.key)).toArray();
  await importInto(db, blob, {
    clearTablesBeforeImport: true,
    acceptVersionDiff: true,
    acceptNameDiff: true,
    acceptMissingTables: true,
    acceptChangedPrimaryKey: true,
    filter: notSecret,
  });
  if (secrets.length) await db.settings.bulkPut(secrets);
}

export function backupFileName(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return `wardrobe-backup-${d}.json`;
}

/** Shares the backup (Google Drive, email...) or falls back to a download. */
export async function shareBackup(db: WardrobeDB = defaultDb): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await createBackup(db);
  const file = new File([blob], backupFileName(), { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Wardrobe backup' });
      await setSetting('backup.lastAt', Date.now(), db);
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setSetting('backup.lastAt', Date.now(), db);
  return 'downloaded';
}
