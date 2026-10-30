// Draws the app icon (white hanger on black) into PNGs without extra dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
export function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const seg = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};
const CX = 0.5, CY = 0.3, R = 0.075, END = Math.PI / 4;
const ex = CX + R * Math.cos(END), ey = CY + R * Math.sin(END);
function hangerDist(x, y) {
  const th = Math.atan2(y - CY, x - CX);
  const arc = th <= END ? Math.abs(Math.hypot(x - CX, y - CY) - R) : Math.min(Math.hypot(x - ex, y - ey), Math.hypot(x - (CX - R), y - CY));
  return Math.min(arc, seg(x, y, ex, ey, 0.5, 0.42), seg(x, y, 0.5, 0.42, 0.16, 0.66), seg(x, y, 0.5, 0.42, 0.84, 0.66), seg(x, y, 0.16, 0.66, 0.84, 0.66));
}
function icon(size, scale) {
  const buf = Buffer.alloc(size * size * 4);
  const half = 0.0225, ss = 4;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let cover = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u = (px + (sx + 0.5) / ss) / size, v = (py + (sy + 0.5) / ss) / size;
      const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale + 0.02;
      if (hangerDist(x, y) <= half) cover++;
    }
    const a = cover / (ss * ss), i = (py * size + px) * 4, c = Math.round(255 * a);
    buf[i] = c; buf[i + 1] = c; buf[i + 2] = c; buf[i + 3] = 255;
  }
  return encodePng(size, size, buf);
}
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icon(192, 0.92));
writeFileSync('public/icons/icon-512.png', icon(512, 0.92));
writeFileSync('public/icons/maskable-512.png', icon(512, 0.66));
writeFileSync('public/icons/apple-touch-icon.png', icon(180, 0.8));
console.log('Icons written to public/icons');
