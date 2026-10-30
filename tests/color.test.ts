import { describe, expect, it } from 'vitest';
import { CLEAR_DE, MATCH_DE, nearestShade, relation, shadeDeltaE } from '@/lib/colorMath';
import { extractColors, pickShades } from '@/lib/colorExtract';
import { fitWithin, rotatedSize } from '@/lib/image';
import { getShade } from '@/domain/palette';

/** A synthetic photo: a garment rectangle (or two halves) on a plain background. */
function photo(bg: string, garment: string, second?: string, w = 60, h = 60) {
  const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = x > w * 0.2 && x < w * 0.8 && y > h * 0.15 && y < h * 0.85;
    const c = inside ? (second && y > h / 2 ? hex(second) : hex(garment)) : hex(bg);
    data.set([...c, 255], (y * w + x) * 4);
  }
  return { data, w, h };
}

describe('color thresholds', () => {
  it('white vs cream is clearly different; white vs off-white is a near match', () => {
    expect(relation(shadeDeltaE('white', 'cream'))).toBe('clear');
    expect(relation(shadeDeltaE('white', 'off-white'))).toBe('near');
    expect(MATCH_DE).toBeLessThan(CLEAR_DE);
  });
  it('flags two navies and faded vs deep black as near misses', () => {
    expect(relation(shadeDeltaE('navy', 'midnight-navy'))).toBe('near');
    expect(relation(shadeDeltaE('black', 'faded-black'))).toBe('near');
    expect(relation(shadeDeltaE('black', 'black'))).toBe('match');
  });
  it('maps colors to the nearest palette shade', () => {
    expect(nearestShade('#1E2944').id).toBe('navy');
    expect(nearestShade('#FFFFFF').id).toBe('white');
  });
});

describe('colors from pixels', () => {
  it.each([
    ['white shirt on grey', '#8A8A8A', getShade('white')!.hex, 'white'],
    ['cream on grey', '#7A7A7A', getShade('cream')!.hex, 'cream'],
    ['navy on white floor', '#F0F0F0', getShade('navy')!.hex, 'navy'],
    ['beige jacket on dark bed', '#2A2A2A', getShade('beige')!.hex, 'beige'],
  ])('%s', (_label, bg, garment, expected) => {
    const p = photo(bg, garment);
    const colors = extractColors(p.data, p.w, p.h);
    expect(colors[0].shadeId).toBe(expected);
  });
  it('finds two shades on a two-tone item', () => {
    const p = photo('#9A9A9A', getShade('navy')!.hex, getShade('white')!.hex);
    const { primary, secondary } = pickShades(extractColors(p.data, p.w, p.h));
    expect([primary, secondary].sort()).toEqual(['navy', 'white']);
  });
});

describe('image sizes', () => {
  it('fits within a max size without upscaling', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(300, 200, 1280)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(3000, 4000, 320)).toEqual({ width: 240, height: 320 });
  });
  it('computes rotated bounds', () => {
    const r = rotatedSize(200, 100, 90);
    expect(Math.round(r.width)).toBe(100);
    expect(Math.round(r.height)).toBe(200);
  });
});
