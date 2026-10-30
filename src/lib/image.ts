export interface Size { width: number; height: number }
export interface Area { x: number; y: number; width: number; height: number }

/** Scales a size to fit within max x max, never upscaling. */
export function fitWithin(width: number, height: number, max: number): Size {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function rotatedSize(width: number, height: number, rotation: number): Size {
  const r = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(r) * width) + Math.abs(Math.sin(r) * height),
    height: Math.abs(Math.sin(r) * width) + Math.abs(Math.cos(r) * height),
  };
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

/** Decodes a photo, applying its EXIF orientation. */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export function drawScaled(src: CanvasImageSource & { width: number; height: number }, max: number): HTMLCanvasElement {
  const { width, height } = fitWithin(src.width, src.height, max);
  const c = canvas(width, height);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));
}

/** Crops (after rotating) a source image, like react-easy-crop expects. */
export function cropImage(src: CanvasImageSource & { width: number; height: number }, area: Area, rotation = 0): HTMLCanvasElement {
  const rot = rotatedSize(src.width, src.height, rotation);
  const big = canvas(rot.width, rot.height);
  const ctx = big.getContext('2d')!;
  ctx.translate(rot.width / 2, rot.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-src.width / 2, -src.height / 2);
  ctx.drawImage(src, 0, 0);
  const out = canvas(area.width, area.height);
  out.getContext('2d')!.drawImage(big, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return out;
}

export interface StoredImages { full: ArrayBuffer; thumb: ArrayBuffer; mime: string; width: number; height: number }

/** A WebP of at most 1280 px plus a 320 px thumbnail. */
export async function makeStoredImages(src: HTMLCanvasElement, fullMax = 1280, thumbMax = 320): Promise<StoredImages> {
  const full = drawScaled(src, fullMax);
  const thumb = drawScaled(src, thumbMax);
  const fullBlob = await canvasToBlob(full, 'image/webp', 0.86);
  const thumbBlob = await canvasToBlob(thumb, 'image/webp', 0.8);
  return { full: await fullBlob.arrayBuffer(), thumb: await thumbBlob.arrayBuffer(), mime: fullBlob.type || 'image/webp', width: full.width, height: full.height };
}

/** A JPEG (about 768 px) as base64, for sending to an AI provider. */
export async function canvasToBase64Jpeg(src: HTMLCanvasElement, max = 768): Promise<{ base64: string; mime: string }> {
  const c = drawScaled(src, max);
  const blob = await canvasToBlob(c, 'image/jpeg', 0.85);
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), mime: 'image/jpeg' };
}

export function pixelsOf(src: HTMLCanvasElement, max = 96): { data: Uint8ClampedArray; width: number; height: number } {
  const c = drawScaled(src, max);
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: c.width, height: c.height };
}

export async function blobToCanvas(blob: Blob, max = 2048): Promise<HTMLCanvasElement> {
  const bmp = await decodeImage(blob);
  const c = drawScaled(bmp, max);
  bmp.close?.();
  return c;
}
