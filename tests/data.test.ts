import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { WardrobeDB, DB_NAME } from '@/data/db';
import { createRepo } from '@/data/repo';
import { createBackup, inspectBackup, restoreBackup, BackupError } from '@/data/backup';
import { getSecret, maskKey, setSecret, setSetting, getSetting } from '@/data/settings';
import { mk } from './helpers';

let k = 0;
const freshDb = () => new WardrobeDB(`test-${Date.now()}-${++k}`);
const readText = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(b); });
const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * seed) % 251).buffer;

describe('repository', () => {
  it('creates, reads, updates and archives items', async () => {
    const repo = createRepo(freshDb());
    const { id: _id, createdAt: _c, updatedAt: _u, archived: _a, ...data } = mk('shirt', 'white');
    const item = await repo.addItem(data);
    expect((await repo.getItem(item.id))?.name).toBe(item.name);
    await repo.updateItem(item.id, { quantity: 2 });
    expect((await repo.getItem(item.id))?.quantity).toBe(2);
    await repo.archiveItem(item.id);
    expect(await repo.listItems()).toHaveLength(0);
    expect(await repo.listItems(true)).toHaveLength(1);
    await repo.restoreItem(item.id);
    expect(await repo.listItems()).toHaveLength(1);
  });
  it('creates, edits and deletes log entries with their selfie', async () => {
    const repo = createRepo(freshDb());
    const selfieId = await repo.savePhoto({ full: bytes(10, 3), thumb: bytes(5, 7), mime: 'image/webp', width: 1, height: 1, kind: 'selfie' });
    const e = await repo.addLogEntry({ date: '2026-10-30', occasionId: 'office', tags: ['client meeting'], slots: { base: 'a', bottom: 'b' }, source: 'suggestion', selfieId });
    await repo.updateLogEntry(e.id, { rating: 4 });
    expect((await repo.listLog())[0].rating).toBe(4);
    await repo.deleteLogEntry(e.id);
    expect(await repo.listLog()).toHaveLength(0);
    expect(await repo.getPhoto(selfieId)).toBeUndefined();
  });
  it('stores each rejection key once and undoes it', async () => {
    const repo = createRepo(freshDb());
    const a = await repo.addRejection({ type: 'item', key: 'i:x', label: 'Never suggest X' });
    const b = await repo.addRejection({ type: 'item', key: 'i:x', label: 'Never suggest X' });
    expect(b.id).toBe(a.id);
    await repo.removeRejection(a.id);
    expect(await repo.listRejections()).toHaveLength(0);
  });
  it('expires cached values', async () => {
    const repo = createRepo(freshDb());
    await repo.setCache('k', { v: 1 }, -1);
    expect(await repo.getCache('k')).toBeUndefined();
    await repo.setCache('k', { v: 2 }, 60_000);
    expect(await repo.getCache('k')).toEqual({ v: 2 });
  });
});

describe('migrations', () => {
  it('upgrades v1 data to the latest version without losing it', async () => {
    const name = `mig-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ items: 'id, type, createdAt', photos: 'id', settings: 'key' });
    await v1.table('items').add(mk('shirt', 'white', {}, { id: 'keep-me' }));
    await v1.table('settings').put({ key: 'prefs.rotationDays', value: 6 });
    v1.close();
    const db = new WardrobeDB(name);
    expect((await db.items.get('keep-me'))?.primaryShade).toBe('white');
    expect(await getSetting('prefs.rotationDays', db)).toBe(6);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['cache', 'items', 'likes', 'logEntries', 'photos', 'rejections', 'settings']);
  });
});

describe('settings and keys', () => {
  it('masks keys and keeps secrets out of normal settings', async () => {
    const db = freshDb();
    await setSecret('secret:gemini', ' AIzaSyExampleKey1234 ', db);
    expect(await getSecret('secret:gemini', db)).toBe('AIzaSyExampleKey1234');
    expect(maskKey('AIzaSyExampleKey1234')).toMatch(/^AIza\u2022+1234$/);
    await setSecret('secret:gemini', '', db);
    expect(await getSecret('secret:gemini', db)).toBe('');
  });
});

describe('backup', () => {
  it('round-trips items, photos and the log, without API keys', async () => {
    const db = freshDb();
    const repo = createRepo(db);
    const photoId = await repo.savePhoto({ full: bytes(300, 7), thumb: bytes(50, 11), mime: 'image/webp', width: 10, height: 12, kind: 'item' });
    const { id: _i, createdAt: _c, updatedAt: _u, archived: _a, ...data } = mk('jeans', 'denim-dark', {}, { photoId });
    const item = await repo.addItem(data);
    await repo.addLogEntry({ date: '2026-10-30', occasionId: 'office', tags: [], slots: { bottom: item.id }, source: 'manual' });
    await setSecret('secret:gemini', 'secret-key-123456', db);
    await setSetting('prefs.rotationDays', 3, db);
    const blob = await createBackup(db);
    const text = await readText(blob);
    expect(text).not.toContain('secret-key-123456');
    const exported = JSON.parse(text).data.tables.map((t: { name: string }) => t.name).sort();
    expect(exported).toEqual(db.tables.map((t) => t.name).sort());

    const target = freshDb();
    await setSecret('secret:gemini', 'phone-key-999999', target);
    await createRepo(target).addLogEntry({ date: '2020-01-01', occasionId: 'home', tags: [], slots: {}, source: 'manual' });
    await restoreBackup(blob, target);
    const restored = await createRepo(target).getItem(item.id);
    expect(restored?.photoId).toBe(photoId);
    const p = await createRepo(target).getPhoto(photoId);
    expect(new Uint8Array(p!.full)).toEqual(new Uint8Array(bytes(300, 7)));
    expect(await createRepo(target).listLog()).toHaveLength(1);
    expect(await getSetting('prefs.rotationDays', target)).toBe(3);
    expect(await getSecret('secret:gemini', target)).toBe('phone-key-999999');
  });
  it('rejects files that are not backups or come from a newer version', async () => {
    await expect(inspectBackup(new Blob(['hello']))).rejects.toBeInstanceOf(BackupError);
    const blob = await createBackup(freshDb());
    const json = JSON.parse(await readText(blob));
    json.data.databaseVersion = 99;
    await expect(inspectBackup(new Blob([JSON.stringify(json)]))).rejects.toThrow(/newer version/);
    json.data.databaseVersion = 4;
    json.data.tables = json.data.tables.filter((t: { name: string }) => t.name !== 'items');
    await expect(inspectBackup(new Blob([JSON.stringify(json)]))).rejects.toThrow(/not a wardrobe backup/);
  });
  it('names the default database', () => expect(DB_NAME).toBe('wardrobe-stylist'));
});
