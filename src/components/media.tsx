import { motion } from 'motion/react';
import { Shirt } from 'lucide-react';
import { usePhotoUrl } from '@/data/hooks';
import { getShade } from '@/domain/palette';
import type { Item, OutfitSlots, Slot } from '@/domain/types';
import { cn } from '@/lib/cn';

export function Photo({ photoId, size = 'thumb', alt, className, layoutId }: { photoId?: string; size?: 'thumb' | 'full'; alt: string; className?: string; layoutId?: string }) {
  const url = usePhotoUrl(photoId, size);
  if (!photoId) {
    return <div className={cn('grid place-items-center bg-surface-2 text-faint', className)} aria-label={alt}><Shirt size={22} strokeWidth={1.5} /></div>;
  }
  if (!url) return <div className={cn('shimmer', className)} aria-label={alt} />;
  return layoutId ? (
    <motion.img layoutId={layoutId} src={url} alt={alt} draggable={false} className={cn('object-cover', className)} />
  ) : (
    <img src={url} alt={alt} draggable={false} loading="lazy" decoding="async" className={cn('object-cover', className)} />
  );
}

export function ShadeDot({ shade, className }: { shade?: string; className?: string }) {
  const s = getShade(shade);
  return <span title={s?.name} className={cn('inline-block size-3 shrink-0 rounded-full border border-white/25', className)} style={{ background: s?.hex ?? '#555' }} />;
}

/** Pieces arranged like a flat-lay board: tops and layers on the left, bottom and shoes on the right. */
export function OutfitCollage({ slots, byId, className }: { slots: OutfitSlots; byId: Map<string, Item>; className?: string }) {
  const piece = (s: Slot) => (slots[s] ? byId.get(slots[s]!) : undefined);
  const left = (['outer', 'mid', 'base'] as Slot[]).map(piece).filter((x): x is Item => !!x);
  const bottom = piece('bottom'), shoes = piece('shoes');
  const tile = (it: Item, cls = '') => (
    <div key={it.id} className={cn('relative min-h-0 overflow-hidden rounded-2xl bg-surface-2', cls)}>
      <Photo photoId={it.photoId} alt={it.name} className="absolute inset-0 size-full" />
    </div>
  );
  return (
    <div className={cn('grid h-64 grid-cols-2 gap-1.5', className)}>
      <div className="flex min-h-0 flex-col gap-1.5">{left.map((it) => tile(it, 'flex-1'))}</div>
      <div className="flex min-h-0 flex-col gap-1.5">
        {bottom && tile(bottom, 'flex-[2]')}
        {shoes && tile(shoes, 'flex-1')}
      </div>
    </div>
  );
}

export function ItemTile({ item, onClick, layoutId, badge }: { item: Item; onClick?: () => void; layoutId?: string; badge?: React.ReactNode }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClick} className="group text-left" aria-label={item.name}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-2">
        <Photo photoId={item.photoId} alt={item.name} layoutId={layoutId} className="absolute inset-0 size-full" />
        {item.quantity > 1 && <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium backdrop-blur">{`\u00d7${item.quantity}`}</span>}
        {badge}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
        <ShadeDot shade={item.primaryShade} />
        <span className="truncate text-sm">{item.name}</span>
      </div>
    </motion.button>
  );
}
