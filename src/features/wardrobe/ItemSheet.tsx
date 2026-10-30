import { AnimatePresence, motion } from 'motion/react';
import { Archive, ArchiveRestore, Ban, Pencil, Undo2, WandSparkles, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useCatalog } from '@/app/hooks';
import { Photo, ShadeDot } from '@/components/media';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { useLogEntries, useRejections } from '@/data/hooks';
import { repo } from '@/data/repo';
import { getShade } from '@/domain/palette';
import { ATTR_LABELS, FORMALITY_LABELS, WARMTH_LABELS, getType, relevantAttrs } from '@/domain/taxonomy';
import { checkItem } from '@/engine/filters';
import { itemKey } from '@/engine/rejections';
import { friendlyDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';

/** Item detail, opened from anywhere with ?item=<id>. The photo flies in from its wardrobe tile. */
export function ItemSheet() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = params.get('item');
  const { byId, occasions } = useCatalog();
  const log = useLogEntries();
  const rejections = useRejections();
  const item = id ? byId.get(id) : undefined;
  const close = () => { const p = new URLSearchParams(params); p.delete('item'); setParams(p, { replace: true }); };
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const stats = useMemo(() => {
    const worn = (log ?? []).filter((e) => id && Object.values(e.slots).includes(id));
    return { count: worn.length, last: worn.map((e) => e.date).sort().pop() };
  }, [log, id]);
  const banned = (rejections ?? []).find((r) => r.type === 'item' && r.key === (id ? itemKey(id) : ''));
  const fits = item ? occasions.filter((o) => checkItem(item, o).ok) : [];

  const go = (path: string) => { navigate(path); };
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div key={item.id} className="fixed inset-0 z-50 overflow-y-auto bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-label={item.name}>
          <motion.div className="mx-auto max-w-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10" drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }} onDragEnd={(_, i) => { if (i.offset.y > 120) close(); }}>
            <div className="flex justify-end">
              <button type="button" aria-label="Close" onClick={close} className="grid size-11 place-items-center rounded-full bg-surface-3"><X size={20} /></button>
            </div>
            <div className="relative mt-2 aspect-[4/5] overflow-hidden rounded-3xl border border-line bg-surface-2">
              <Photo photoId={item.photoId} size="full" alt={item.name} layoutId={location.pathname === '/wardrobe' ? `item-${item.id}` : undefined} className="absolute inset-0 size-full" />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{item.name}</h2>
              <p className="mt-1 flex items-center gap-2 text-muted">
                <ShadeDot shade={item.primaryShade} /> {getType(item.type).label} {'\u00b7'} {getShade(item.primaryShade)?.name}
                {item.secondaryShade && <> + {getShade(item.secondaryShade)?.name}</>}
                {item.quantity > 1 && <> {'\u00b7'} {'\u00d7'}{item.quantity}</>}
              </p>
              {item.archived && <p className="mt-2 text-sm text-warn">Archived: hidden from suggestions, still shown in your log.</p>}
              {banned && <p className="mt-2 text-sm text-danger">Never suggested (you rejected it).</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {relevantAttrs(item.type, item.attrs).map((k) => (
                  <span key={k} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm">{ATTR_LABELS[k].values[item.attrs[k] as string]}</span>
                ))}
                <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm">{FORMALITY_LABELS[item.formality]}</span>
                <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm">{WARMTH_LABELS[item.warmth]}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl border border-line bg-surface p-3"><div className="text-faint">Worn</div><div className="mt-1 text-lg font-semibold">{stats.count} time{stats.count === 1 ? '' : 's'}</div></div>
                <div className="rounded-2xl border border-line bg-surface p-3"><div className="text-faint">Last worn</div><div className="mt-1 text-lg font-semibold">{stats.last ? friendlyDate(stats.last) : 'Not yet'}</div></div>
              </div>
              <p className="mt-4 text-sm text-muted">Fits: {fits.length ? fits.map((o) => o.short).join(', ') : 'no occasion yet (check its tags)'}</p>
              <div className="mt-6 grid gap-2">
                {!item.archived && !banned && (
                  <Button variant="primary" icon={<WandSparkles size={18} />} onClick={() => go(`/suggest?occasion=${(fits.find((o) => o.id === 'casual') ?? fits[0] ?? occasions[1]).id}&include=${item.id}`)}>Style this item</Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<Pencil size={18} />} onClick={() => go(`/wardrobe/edit/${item.id}`)}>Edit</Button>
                  {banned ? (
                    <Button icon={<Undo2 size={18} />} onClick={async () => { await repo.removeRejection(banned.id); toast('It can be suggested again'); }}>Allow again</Button>
                  ) : (
                    <Button icon={<Ban size={18} />} onClick={async () => { haptic(); await repo.addRejection({ type: 'item', key: itemKey(item.id), label: `Never suggest ${item.name}` }); toast('Won\u2019t be suggested'); }}>Never suggest</Button>
                  )}
                </div>
                {item.archived ? (
                  <Button icon={<ArchiveRestore size={18} />} onClick={async () => { await repo.restoreItem(item.id); toast('Back in your wardrobe'); }}>Restore</Button>
                ) : (
                  <Button variant="danger" icon={<Archive size={18} />} onClick={async () => { await repo.archiveItem(item.id); toast('Archived', { action: { label: 'Undo', run: () => repo.restoreItem(item.id) } }); close(); }}>Remove (archive)</Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
