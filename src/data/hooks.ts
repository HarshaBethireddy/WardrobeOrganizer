import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './db';
import type { Item, Like, LogEntry, Rejection } from '@/domain/types';

const photoUrls = new Map<string, string>();

export function usePhotoUrl(photoId: string | undefined, size: 'thumb' | 'full' = 'thumb'): string | undefined {
  const key = photoId ? `${photoId}:${size}` : '';
  const cached = key ? photoUrls.get(key) : undefined;
  const photo = useLiveQuery(() => (photoId && !cached ? db.photos.get(photoId) : undefined), [photoId, cached]);
  const [url, setUrl] = useState<string | undefined>(cached);
  useEffect(() => {
    if (!key) return setUrl(undefined);
    const hit = photoUrls.get(key);
    if (hit) return setUrl(hit);
    if (!photo) return;
    const u = URL.createObjectURL(new Blob([size === 'thumb' ? photo.thumb : photo.full], { type: photo.mime }));
    photoUrls.set(key, u);
    setUrl(u);
  }, [key, photo, size]);
  return url;
}

export function forgetPhotoUrl(photoId: string) {
  for (const size of ['thumb', 'full']) {
    const k = `${photoId}:${size}`;
    const u = photoUrls.get(k);
    if (u) URL.revokeObjectURL(u);
    photoUrls.delete(k);
  }
}

export const useItems = (): Item[] | undefined => useLiveQuery(() => db.items.orderBy('createdAt').toArray(), []);
export const useActiveItems = (): Item[] | undefined =>
  useLiveQuery(() => db.items.orderBy('createdAt').toArray().then((l) => l.filter((i) => !i.archived)), []);
export const useLogEntries = (): LogEntry[] | undefined => useLiveQuery(() => db.logEntries.orderBy('date').reverse().toArray(), []);
export const useRejections = (): Rejection[] | undefined => useLiveQuery(() => db.rejections.orderBy('createdAt').reverse().toArray(), []);
export const useLikes = (): Like[] | undefined => useLiveQuery(() => db.likes.toArray(), []);

export function itemsById(items: Item[] | undefined): Map<string, Item> {
  return new Map((items ?? []).map((i) => [i.id, i]));
}
