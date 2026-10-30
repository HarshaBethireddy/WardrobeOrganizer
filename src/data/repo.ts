import { db as defaultDb, type WardrobeDB } from './db';
import type { Item, Like, LogEntry, Photo, Rejection } from '@/domain/types';
import { uid } from '@/lib/id';

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & { archived?: boolean };

export function createRepo(db: WardrobeDB = defaultDb) {
  return {
    db,
    // Items
    async addItem(data: NewItem): Promise<Item> {
      const now = Date.now();
      const item: Item = { ...data, archived: data.archived ?? false, id: uid('i'), createdAt: now, updatedAt: now };
      await db.items.add(item);
      return item;
    },
    async updateItem(id: string, patch: Partial<Item>): Promise<void> {
      await db.items.update(id, { ...patch, updatedAt: Date.now() });
    },
    async archiveItem(id: string) {
      await db.items.update(id, { archived: true, updatedAt: Date.now() });
    },
    async restoreItem(id: string) {
      await db.items.update(id, { archived: false, updatedAt: Date.now() });
    },
    getItem: (id: string) => db.items.get(id),
    async listItems(includeArchived = false): Promise<Item[]> {
      const all = await db.items.orderBy('createdAt').toArray();
      return includeArchived ? all : all.filter((i) => !i.archived);
    },
    // Photos
    async savePhoto(p: Omit<Photo, 'id' | 'createdAt'>): Promise<string> {
      const id = uid('p');
      await db.photos.add({ ...p, id, createdAt: Date.now() });
      return id;
    },
    getPhoto: (id: string) => db.photos.get(id),
    deletePhoto: (id: string) => db.photos.delete(id),
    // Log
    async addLogEntry(e: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<LogEntry> {
      const now = Date.now();
      const entry: LogEntry = { ...e, id: uid('l'), createdAt: now, updatedAt: now };
      await db.logEntries.add(entry);
      return entry;
    },
    async updateLogEntry(id: string, patch: Partial<LogEntry>) {
      await db.logEntries.update(id, { ...patch, updatedAt: Date.now() });
    },
    async deleteLogEntry(id: string) {
      const e = await db.logEntries.get(id);
      await db.transaction('rw', db.logEntries, db.photos, async () => {
        if (e?.selfieId) await db.photos.delete(e.selfieId);
        await db.logEntries.delete(id);
      });
    },
    listLog: () => db.logEntries.orderBy('date').reverse().toArray(),
    // Rejections
    async addRejection(r: Omit<Rejection, 'id' | 'createdAt'>): Promise<Rejection> {
      const existing = await db.rejections.where('key').equals(r.key).first();
      if (existing) return existing;
      const row: Rejection = { ...r, id: uid('r'), createdAt: Date.now() };
      await db.rejections.add(row);
      return row;
    },
    removeRejection: (id: string) => db.rejections.delete(id),
    listRejections: () => db.rejections.orderBy('createdAt').reverse().toArray(),
    // Likes
    async addLike(l: Omit<Like, 'id' | 'createdAt'>): Promise<Like> {
      const row: Like = { ...l, id: uid('k'), createdAt: Date.now() };
      await db.likes.add(row);
      return row;
    },
    removeLike: (id: string) => db.likes.delete(id),
    // Cache
    async getCache<T>(key: string): Promise<T | undefined> {
      const row = await db.cache.get(key);
      if (!row) return undefined;
      if (row.expiresAt < Date.now()) {
        await db.cache.delete(key);
        return undefined;
      }
      return row.value as T;
    },
    async setCache(key: string, value: unknown, ttlMs: number) {
      await db.cache.put({ key, value, expiresAt: Date.now() + ttlMs });
    },
  };
}

export const repo = createRepo();
export type Repo = ReturnType<typeof createRepo>;
