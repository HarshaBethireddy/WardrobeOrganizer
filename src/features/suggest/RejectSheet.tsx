import { Ban, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { repo } from '@/data/repo';
import type { Item, OutfitSlots } from '@/domain/types';
import { rejectOptions } from '@/engine/rejections';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

/** Lets you choose exactly what to block: this outfit, a pair of items, a color pairing, or an item. */
export function RejectSheet({ open, onClose, slots, byId, onRejected }: { open: boolean; onClose: () => void; slots: OutfitSlots; byId: Map<string, Item>; onRejected?: () => void }) {
  const options = useMemo(() => rejectOptions(slots, byId), [slots, byId]);
  const [pick, setPick] = useState(0);
  useEffect(() => { if (open) setPick(0); }, [open]);
  const confirm = async () => {
    const o = options[pick];
    if (!o) return;
    haptic([10, 40, 10]);
    const row = await repo.addRejection(o);
    onClose();
    onRejected?.();
    toast(`Hidden: ${o.label}`, { action: { label: 'Undo', run: () => repo.removeRejection(row.id) } });
  };
  const groups: { title: string; type: string }[] = [
    { title: 'Outfit', type: 'outfit' }, { title: 'Color pairing', type: 'colors' }, { title: 'Two items together', type: 'pair' }, { title: 'One item', type: 'item' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Don't show this again" footer={<Button variant="danger" className="w-full" icon={<Ban size={18} />} onClick={confirm}>Never show this</Button>}>
      <p className="mb-3 text-sm text-muted">Pick what you don't like. You can undo any of these in Settings.</p>
      {groups.map((g) => {
        const list = options.map((o, i) => ({ o, i })).filter(({ o }) => o.type === g.type);
        if (!list.length) return null;
        return (
          <div key={g.type} className="mb-3">
            <div className="mb-1 px-1 text-xs uppercase tracking-[0.12em] text-faint">{g.title}</div>
            <div role="radiogroup" aria-label={g.title} className="overflow-hidden rounded-2xl border border-line">
              {list.map(({ o, i }) => (
                <button key={o.key} type="button" role="radio" aria-checked={pick === i} onClick={() => setPick(i)}
                  className={cn('flex min-h-12 w-full items-center gap-3 border-b border-line px-4 text-left text-[15px] last:border-b-0', pick === i ? 'bg-white/10' : 'bg-surface-2')}>
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', pick === i ? 'border-white bg-white text-black' : 'border-white/30')}>{pick === i && <Check size={13} strokeWidth={3} />}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
