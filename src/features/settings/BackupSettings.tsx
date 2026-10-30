import { format } from 'date-fns';
import { Download, HardDrive, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/toast';
import { Button, Card, Section } from '@/components/ui';
import { BackupError, inspectBackup, restoreBackup, shareBackup, type BackupSummary } from '@/data/backup';
import { setSetting, useSetting } from '@/data/settings';
import { BackupReminder } from '@/features/wardrobe/WardrobeScreen';

const TABLE_LABELS: Record<string, string> = { items: 'Items', photos: 'Photos', logEntries: 'Log entries', rejections: 'Rejections', likes: 'Likes', settings: 'Settings', cache: 'Cached data' };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;

export function BackupSettings() {
  const [lastAt] = useSetting('backup.lastAt');
  const [persisted] = useSetting('storage.persisted');
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [pending, setPending] = useState<{ file: File; summary: BackupSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => undefined); }, [lastAt, busy]);

  const backup = async () => {
    setBusy(true);
    try {
      const r = await shareBackup();
      if (r !== 'cancelled') toast(r === 'shared' ? 'Backup shared' : 'Backup downloaded');
    } catch { toast('Backup failed', { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  const pick = async (file: File) => {
    try { setPending({ file, summary: await inspectBackup(file) }); }
    catch (e) { toast(e instanceof BackupError ? e.message : 'This file could not be read.', { tone: 'danger' }); }
  };
  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try { await restoreBackup(pending.file); setPending(null); toast('Restored. Your wardrobe is back.'); }
    catch (e) { toast(e instanceof BackupError ? e.message : 'Restore failed. Nothing was changed.', { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Backup">
      <div id="backup" />
      <div className="mb-2"><BackupReminder /></div>
      <Card>
        <p className="text-sm text-muted">Everything lives only on this phone. A backup file holds your items, photos, log, selfies and rejections (not your API keys). Save it to Google Drive or email it to yourself.</p>
        <p className="mt-2 text-sm">Last backup: {lastAt ? format(lastAt, 'd MMM yyyy, HH:mm') : 'never'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" icon={<Download size={18} />} disabled={busy} onClick={backup}>Back up now</Button>
          <Button icon={<Upload size={18} />} disabled={busy} onClick={() => input.current?.click()}>Restore</Button>
        </div>
        <input ref={input} type="file" accept="application/json,.json" hidden data-testid="restore-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }} />
        <div className="mt-4 flex items-start gap-2 text-sm text-muted">
          <HardDrive size={16} className="mt-0.5 shrink-0" />
          <div>
            {usage ? `Using ${mb(usage.used)} of ${mb(usage.quota)} available.` : 'Storage use unknown.'}{' '}
            {persisted === true ? 'Storage is protected from automatic clean-up.' : persisted === false ? 'The browser may clear storage when space runs low; keep backups.' : ''}
            {persisted !== true && navigator.storage?.persist && (
              <button type="button" className="ml-1 underline" onClick={async () => { const ok = await navigator.storage.persist(); await setSetting('storage.persisted', ok); toast(ok ? 'Storage is now protected' : 'The browser said no. Install the app to the home screen and try again.'); }}>Protect storage</button>
            )}
          </div>
        </div>
      </Card>
      <Sheet open={!!pending} onClose={() => setPending(null)} title="Restore this backup?"
        footer={<div className="grid grid-cols-2 gap-2"><Button onClick={() => setPending(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={restore}>{busy ? 'Restoring\u2026' : 'Replace all data'}</Button></div>}>
        <p className="text-muted">This replaces everything on this phone with the backup. Your API keys stay as they are.</p>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line">
          {pending?.summary.tables.filter((t) => TABLE_LABELS[t.name]).map((t) => (
            <li key={t.name} className="flex min-h-11 items-center justify-between border-b border-line bg-surface-2 px-4 text-sm last:border-b-0"><span>{TABLE_LABELS[t.name]}</span><span className="tabular-nums">{t.rowCount}</span></li>
          ))}
        </ul>
      </Sheet>
    </Section>
  );
}
