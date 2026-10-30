import { deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** A plain-background "photo" with a garment-colored rectangle in the middle. */
export function garmentPng(hex: string, bg = '#8a8a8a', w = 240, h = 300): Buffer {
  const rgb = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [g, b] = [rgb(hex), rgb(bg)];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const inside = x > w * 0.2 && x < w * 0.8 && y > h * 0.12 && y < h * 0.88;
      const c = inside ? g : b;
      raw.set(c, y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const base = { isClothing: true, itemCount: 1, secondaryShade: 'none', sleeve: 'na', neck: 'na', pattern: 'solid', wash: 'na', distress: 'none', fit: 'regular', canOpen: false, warmth: 2, confidence: 0.9 };
export const ITEMS = [
  { file: 'white-shirt.png', hex: '#f6f6f4', tag: { ...base, type: 'shirt', name: 'White shirt', primaryShade: 'white', closure: 'buttons', sleeve: 'long', neck: 'spread-collar', material: 'cotton', canOpen: true, formality: 3, warmth: 1 } },
  { file: 'dark-jeans.png', hex: '#2a3b57', tag: { ...base, type: 'jeans', name: 'Dark blue jeans', primaryShade: 'denim-dark', closure: 'buttons', wash: 'dark', material: 'denim', formality: 3 } },
  { file: 'white-sneakers.png', hex: '#f4f4f2', tag: { ...base, type: 'sneakers', name: 'White sneakers', primaryShade: 'white', closure: 'laces', material: 'leather', formality: 2, warmth: 1 } },
  { file: 'black-jeans.png', hex: '#141414', tag: { ...base, type: 'jeans', name: 'Black jeans', primaryShade: 'black', closure: 'buttons', wash: 'black', material: 'denim', formality: 3 } },
  { file: 'beige-jacket.png', hex: '#d8c6a5', tag: { ...base, type: 'jacket', name: 'Beige button jacket', primaryShade: 'beige', closure: 'buttons', sleeve: 'long', material: 'cotton', formality: 3 } },
  { file: 'black-shirt.png', hex: '#121212', tag: { ...base, type: 'shirt', name: 'Black shirt', primaryShade: 'black', closure: 'buttons', sleeve: 'long', neck: 'spread-collar', material: 'cotton', canOpen: true, formality: 3, warmth: 1 } },
];

export const localDate = (offsetDays = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Mocks Gemini (tagging, parsing, review, check) and Open-Meteo, so the test is free and deterministic. */
export async function mockServices(page: Page) {
  let tagged = 0;
  // Headless Chromium has no share sheet: make backups fall back to a download.
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    const sys = String(body.system_instruction ?? '');
    let payload: unknown = { ok: true };
    if (Array.isArray(body.input) && body.input.some((p: { type: string }) => p.type === 'image')) payload = ITEMS[Math.min(tagged++, ITEMS.length - 1)].tag;
    else if (sys.includes('You turn a request')) {
      const q = String(body.input?.[0]?.text ?? '').match(/Request: """([\s\S]*?)"""/)?.[1] ?? '';
      payload = /office/i.test(q) ? { kind: 'outfit', occasionId: 'office', date: localDate(1), include: [], exclude: [] } : { kind: 'unknown' };
    } else if (sys.includes('Reorder the given outfits')) payload = { order: [{ id: 'o2', reason: 'Crisp and office-ready', concern: '' }, { id: 'o1', reason: 'Clean contrast', concern: '' }] };
    else if (sys.includes('quick honest opinion')) payload = { opinion: 'Sharp and simple. The contrast reads well.', swapSlot: 'none', swapItemId: '', swapReason: '' };
    await route.fulfill({ json: { output_text: JSON.stringify(payload) } });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({ json: { results: [{ name: 'Bengaluru', latitude: 12.97, longitude: 77.59, admin1: 'Karnataka', country: 'India' }] } }));
  await page.route('https://api.open-meteo.com/**', (route) => {
    const days = Array.from({ length: 16 }, (_, i) => localDate(i));
    route.fulfill({ json: { daily: { time: days, temperature_2m_max: days.map(() => 22), temperature_2m_min: days.map(() => 16), precipitation_probability_max: days.map(() => 10), weather_code: days.map(() => 2) } } });
  });
}
