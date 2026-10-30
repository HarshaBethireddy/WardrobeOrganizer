import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { db as defaultDb, type WardrobeDB } from './db';
import type { CustomOccasion, GeoLocation } from '@/domain/types';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'none';
export type SecretKey = 'secret:gemini' | 'secret:groq' | 'secret:openrouter';

export const DEFAULTS = {
  'ai.primary': 'gemini' as ProviderId,
  'ai.fallback': 'none' as ProviderId,
  'ai.geminiModel': 'gemini-3.8-flash',
  'ai.groqModel': 'qwen/qwen3.8-27b',
  'ai.openrouterModel': '',
  'ai.review': true,
  'ai.requests': { date: '', count: 0 },
  'ondevice.ready': false,
  'weather.location': null as GeoLocation | null,
  'prefs.rotationDays': 4,
  'prefs.useHistory': true,
  'ui.reduceMotion': false,
  'ui.haptics': true,
  'backup.lastAt': 0,
  'storage.persisted': null as boolean | null,
  'occasions.custom': [] as CustomOccasion[],
};

export type SettingKey = keyof typeof DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof DEFAULTS)[K];

export const isSecretKey = (key: string) => key.startsWith('secret:');

export async function getSetting<K extends SettingKey>(key: K, db: WardrobeDB = defaultDb): Promise<SettingValue<K>> {
  const row = await db.settings.get(key);
  return (row ? row.value : DEFAULTS[key]) as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>, db: WardrobeDB = defaultDb) {
  await db.settings.put({ key, value });
}

export async function getSecret(key: SecretKey, db: WardrobeDB = defaultDb): Promise<string> {
  const row = await db.settings.get(key);
  return typeof row?.value === 'string' ? row.value : '';
}

export async function setSecret(key: SecretKey, value: string, db: WardrobeDB = defaultDb) {
  if (value.trim()) await db.settings.put({ key, value: value.trim() });
  else await db.settings.delete(key);
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '\u2022'.repeat(key.length);
  return `${key.slice(0, 4)}${'\u2022'.repeat(Math.min(12, key.length - 8))}${key.slice(-4)}`;
}

export function useSetting<K extends SettingKey>(key: K): [SettingValue<K>, (v: SettingValue<K>) => Promise<void>, boolean] {
  const row = useLiveQuery(() => defaultDb.settings.get(key).then((r) => r ?? null), [key]);
  const set = useCallback((v: SettingValue<K>) => setSetting(key, v), [key]);
  const loaded = row !== undefined;
  const value = (row ? row.value : DEFAULTS[key]) as SettingValue<K>;
  return [value, set, loaded];
}

export function useSecret(key: SecretKey): [string, (v: string) => Promise<void>] {
  const row = useLiveQuery(() => defaultDb.settings.get(key).then((r) => r ?? null), [key]);
  const set = useCallback((v: string) => setSecret(key, v), [key]);
  return [typeof row?.value === 'string' ? row.value : '', set];
}

/** Daily AI request counter (informational). */
export async function countAiRequest(today: string, db: WardrobeDB = defaultDb) {
  const cur = await getSetting('ai.requests', db);
  await setSetting('ai.requests', cur.date === today ? { date: today, count: cur.count + 1 } : { date: today, count: 1 }, db);
}
