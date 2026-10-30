import { differenceCiede2000 } from 'culori';
import { SHADES, getShade } from '@/domain/palette';

/** CIEDE2000 below this: the same color. */
export const MATCH_DE = 2.5;
/** CIEDE2000 at or above this: clearly different, so the pairing looks deliberate. Between the two: a near miss. */
export const CLEAR_DE = 10;

export interface Oklab { L: number; a: number; b: number }

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toGamma = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);

export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToHex({ L, a, b }: Oklab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return rgbToHex(toGamma(r), toGamma(g), toGamma(bl));
}

export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = hexToRgb(hex);
  return rgbToOklab(r, g, b);
}

/** HSL hue in degrees (0-360) and saturation (0-1), for color-wheel relationships. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r0) h = (g0 - b0) / d + (g0 < b0 ? 6 : 0);
  else if (max === g0) h = (b0 - r0) / d + 2;
  else h = (r0 - g0) / d + 4;
  return { h: h * 60, s, l };
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const ciede = differenceCiede2000();
const deCache = new Map<string, number>();

export function deltaE(hexA: string, hexB: string): number {
  const key = hexA < hexB ? `${hexA}|${hexB}` : `${hexB}|${hexA}`;
  const hit = deCache.get(key);
  if (hit !== undefined) return hit;
  const v = ciede(hexA, hexB);
  deCache.set(key, v);
  return v;
}

export function shadeDeltaE(a: string, b: string): number {
  const sa = getShade(a), sb = getShade(b);
  if (!sa || !sb) return 100;
  return deltaE(sa.hex, sb.hex);
}

export type ColorRelation = 'match' | 'near' | 'clear';
export function relation(de: number): ColorRelation {
  if (de < MATCH_DE) return 'match';
  if (de < CLEAR_DE) return 'near';
  return 'clear';
}

export interface ShadeMetrics { L: number; C: number; hue: number; hslHue: number; hslSat: number }
const metricsCache = new Map<string, ShadeMetrics>();

export function shadeMetrics(id: string): ShadeMetrics {
  const hit = metricsCache.get(id);
  if (hit) return hit;
  const hex = getShade(id)?.hex ?? '#888888';
  const lab = hexToOklab(hex);
  const hsl = hexToHsl(hex);
  const m: ShadeMetrics = {
    L: lab.L,
    C: Math.hypot(lab.a, lab.b),
    hue: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360,
    hslHue: hsl.h,
    hslSat: hsl.s,
  };
  metricsCache.set(id, m);
  return m;
}

/** Nearest named palette shade to a color, by CIEDE2000. */
export function nearestShade(hex: string): { id: string; de: number } {
  let best = { id: 'grey', de: Infinity };
  for (const s of SHADES) {
    if (s.family === 'multi') continue;
    const de = deltaE(hex, s.hex);
    if (de < best.de) best = { id: s.id, de };
  }
  return best;
}
