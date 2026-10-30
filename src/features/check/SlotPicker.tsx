import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Photo } from '@/components/media';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { canFill } from '@/domain/taxonomy';
import { SLOT_LABELS, type Item, type Slot } from '@/domain/types';

export function SlotButton({ slot, item, optional, onClick }: { slot: Slot; item?: Item; optional?: boolean; onClick: () => void }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClick} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2 text-left" aria-label={`${SLOT_LABELS[slot]}: ${item?.name ?? 'choose'}`}>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {item ? <Photo photoId={item.photoId} alt={item.name} className="absolute inset-0 size-full" /> : <div className="grid size-full place-items-center text-faint"><Plus size={20} /></div>}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.12em] text-faint">{SLOT_LABELS[slot]}{optional ? ' (optional)' : ''}</div>
        <div className="truncate text-[15px]">{item?.name ?? 'Choose'}</div>
      </div>
    </motion.button>
  );
}

export function SlotPicker({ slot, open, onClose, items, value, optional, onPick }: {
  slot: Slot; open: boolean; onClose: () => void; items: Item[]; value?: string; optional?: boolean; onPick: (id: string | undefined) => void;
}) {
  const fit = items.filter((i) => !i.archived && canFill(i.type, slot));
  return (
    <Sheet open={open} onClose={onClose} title={`Choose ${SLOT_LABELS[slot].toLowerCase()}`} full>
      {optional && <Button className="mb-3 w-full" onClick={() => { onPick(undefined); onClose(); }}>None</Button>}
      {!fit.length && <p className="text-muted">Nothing in your wardrobe fits this slot yet.</p>}
      <div className="grid grid-cols-3 gap-2">
        {fit.map((it) => (
          <button key={it.id} type="button" onClick={() => { onPick(it.id); onClose(); }} aria-pressed={value === it.id} className="text-left">
            <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl border bg-surface-2 ${value === it.id ? 'border-white ring-2 ring-white' : 'border-line'}`}>
              <Photo photoId={it.photoId} alt={it.name} className="absolute inset-0 size-full" />
            </div>
            <div className="mt-1 truncate text-xs">{it.name}</div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
