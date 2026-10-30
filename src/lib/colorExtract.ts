import { getShade } from '@/domain/palette';
import { CLEAR_DE, nearestShade, oklabToHex, rgbToOklab, shadeDeltaE, type Oklab } from './colorMath';

export interface ExtractedColor {
  shadeId: string;
  hex: string;
  share: number;
}

/** Pixels closer than this (OKLab distance) to the estimated background are dropped. */
const BG_DISTANCE = 0.07;
const MIN_SHARE = 0.15;
const BORDER = 3;

const dist = (p: Oklab, q: Oklab) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

interface WeightedPoint { p: Oklab; w: number }

function kmeans(points: WeightedPoint[], k: number, iterations = 12): { center: Oklab; weight: number }[] {
  if (points.length === 0) return [];
  // Deterministic farthest-point initialisation, starting from the weighted mean.
  const total = points.reduce((s, x) => s + x.w, 0);
  const mean: Oklab = {
    L: points.reduce((s, x) => s + x.p.L * x.w, 0) / total,
    a: points.reduce((s, x) => s + x.p.a * x.w, 0) / total,
    b: points.reduce((s, x) => s + x.p.b * x.w, 0) / total,
  };
  const centers: Oklab[] = [];
  let first = points[0].p, bestD = Infinity;
  for (const x of points) {
    const d = dist(x.p, mean);
    if (d < bestD) { bestD = d; first = x.p; }
  }
  centers.push({ ...first });
  while (centers.length < k) {
    let far = points[0].p, farD = -1;
    for (const x of points) {
      const d = Math.min(...centers.map((c) => dist(c, x.p))) * Math.sqrt(x.w);
      if (d > farD) { farD = d; far = x.p; }
    }
    if (farD <= 1e-6) break;
    centers.push({ ...far });
  }
  const assign = new Array<number>(points.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    points.forEach((x, i) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, ci) => {
        const d = dist(c, x.p);
        if (d < bd) { bd = d; bi = ci; }
      });
      assign[i] = bi;
    });
    centers.forEach((c, ci) => {
      let sw = 0, L = 0, a = 0, b = 0;
      points.forEach((x, i) => {
        if (assign[i] !== ci) return;
        sw += x.w; L += x.p.L * x.w; a += x.p.a * x.w; b += x.p.b * x.w;
      });
      if (sw > 0) { c.L = L / sw; c.a = a / sw; c.b = b / sw; }
    });
  }
  return centers.map((center, ci) => ({
    center,
    weight: points.reduce((s, x, i) => s + (assign[i] === ci ? x.w : 0), 0),
  }));
}

/**
 * Finds the main colors of a garment photo.
 * The background is estimated from the border, nearby pixels are dropped, the center counts more,
 * and the remaining pixels are grouped into 3 clusters that are matched to palette shades.
 */
export function extractColors(data: Uint8ClampedArray | number[], width: number, height: number): ExtractedColor[] {
  const border: WeightedPoint[] = [];
  const all: { p: Oklab; x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const p = rgbToOklab(data[i], data[i + 1], data[i + 2]);
      all.push({ p, x, y });
      if (x < BORDER || y < BORDER || x >= width - BORDER || y >= height - BORDER) border.push({ p, w: 1 });
    }
  }
  if (all.length === 0) return [];
  const bgClusters = kmeans(border, 2, 8).sort((a, b) => b.weight - a.weight);
  const bg = bgClusters[0]?.center;
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const rmax = Math.hypot(cx, cy) || 1;
  const weightAt = (x: number, y: number) => 1 - 0.6 * (Math.hypot(x - cx, y - cy) / rmax) ** 2;

  let fg: WeightedPoint[] = all.filter((q) => !bg || dist(q.p, bg) >= BG_DISTANCE).map((q) => ({ p: q.p, w: weightAt(q.x, q.y) }));
  if (fg.length < all.length * 0.05) {
    // Garment blends into the background: fall back to the central region.
    fg = all
      .filter((q) => Math.abs(q.x - cx) < width / 4 && Math.abs(q.y - cy) < height / 4)
      .map((q) => ({ p: q.p, w: 1 }));
  }
  const clusters = kmeans(fg, 3);
  const total = clusters.reduce((s, c) => s + c.weight, 0) || 1;
  const merged = new Map<string, ExtractedColor>();
  for (const c of clusters.sort((a, b) => b.weight - a.weight)) {
    const share = c.weight / total;
    if (share < MIN_SHARE) continue;
    const hex = oklabToHex(c.center);
    const { id } = nearestShade(hex);
    const prev = merged.get(id);
    if (prev) prev.share += share;
    else merged.set(id, { shadeId: id, hex, share });
  }
  return [...merged.values()].sort((a, b) => b.share - a.share);
}

/** Picks a main shade and an optional second shade from extracted colors. */
export function pickShades(colors: ExtractedColor[]): { primary?: string; secondary?: string } {
  const [first, ...rest] = colors;
  if (!first) return {};
  const second = rest.find((c) => {
    const a = getShade(first.shadeId), b = getShade(c.shadeId);
    return a && b && (a.family !== b.family || shadeDeltaE(a.id, b.id) >= CLEAR_DE);
  });
  return { primary: first.shadeId, secondary: second?.shadeId };
}
