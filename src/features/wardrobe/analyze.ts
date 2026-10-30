import { AiError, userMessage } from '@/ai/errors';
import { manualDraft, type ItemDraft } from '@/ai/normalize';
import { tagOnDevice } from '@/ai/ondevice/client';
import { aiConfigured, tagWithAi } from '@/ai/service';
import { getSetting } from '@/data/settings';
import type { Item } from '@/domain/types';
import { extractColors, pickShades, type ExtractedColor } from '@/lib/colorExtract';
import { blobToCanvas, canvasToBase64Jpeg, canvasToBlob, pixelsOf } from '@/lib/image';

export interface Analysis {
  draft: ItemDraft;
  colors: ExtractedColor[];
  via: 'ai' | 'on-device' | 'manual';
  provider?: string;
  /** Shown above the form when AI could not tag the photo. */
  problem?: { message: string; kind?: string };
}

/** Re-encodes a picked photo (orientation applied) at most 1600 px, to keep bulk adds light on memory. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const c = await blobToCanvas(file, 1600);
  return canvasToBlob(c, 'image/webp', 0.9);
}

export async function analyzePhoto(photo: Blob, opts: { useAi?: boolean } = {}): Promise<Analysis> {
  const canvas = await blobToCanvas(photo, 1024);
  const { data, width, height } = pixelsOf(canvas, 96);
  const colors = extractColors(data, width, height);
  const pixel = pickShades(colors);
  let problem: Analysis['problem'];
  if (opts.useAi !== false && (await aiConfigured())) {
    try {
      const image = await canvasToBase64Jpeg(canvas, 768);
      const d = await tagWithAi(image, pixel);
      return { draft: d, colors, via: 'ai', provider: d.provider };
    } catch (e) {
      problem = { message: userMessage(e), kind: e instanceof AiError ? e.kind : undefined };
      if (e instanceof AiError && (e.kind === 'not-clothing' || e.kind === 'multiple-items')) {
        return { draft: manualDraft(pixel), colors, via: 'manual', problem };
      }
    }
  }
  if (await getSetting('ondevice.ready')) {
    try {
      const d = await tagOnDevice(await canvasToBlob(canvas, 'image/jpeg', 0.9), pixel);
      return { draft: d, colors, via: 'on-device', problem };
    } catch {
      /* fall through to manual tagging */
    }
  }
  return { draft: manualDraft(pixel), colors, via: 'manual', problem };
}

/** Same type, main shade and pattern as an item you already own. */
export function findDuplicate(items: Item[], d: Pick<ItemDraft, 'type' | 'primaryShade' | 'attrs'>, exceptId?: string): Item | undefined {
  return items.find((i) => !i.archived && i.id !== exceptId && i.type === d.type && i.primaryShade === d.primaryShade && i.attrs.pattern === d.attrs.pattern);
}
