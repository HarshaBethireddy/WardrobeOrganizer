import Dexie, { type Table } from 'dexie';
import type { CacheRow, Item, Like, LogEntry, Photo, Rejection, SettingRow } from '@/domain/types';

export const DB_NAME = 'wardrobe-stylist';
export const DB_VERSION = 4;

export class WardrobeDB extends Dexie {
  declare items: Table<Item, string>;
  declare photos: Table<Photo, string>;
  declare settings: Table<SettingRow, string>;
  declare logEntries: Table<LogEntry, string>;
  declare rejections: Table<Rejection, string>;
  declare likes: Table<Like, string>;
  declare cache: Table<CacheRow, string>;

  constructor(name = DB_NAME) {
    super(name);
    // Each version only adds tables, so upgrades keep existing data.
    this.version(1).stores({ items: 'id, type, createdAt', photos: 'id', settings: 'key' });
    this.version(2).stores({ logEntries: 'id, date, occasionId, createdAt' });
    this.version(3).stores({ rejections: 'id, type, &key, createdAt' });
    this.version(4).stores({ likes: 'id, createdAt', cache: 'key' });
  }
}

export const db = new WardrobeDB();
