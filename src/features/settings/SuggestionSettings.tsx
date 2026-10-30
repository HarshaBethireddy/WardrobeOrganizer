import { Minus, Plus, Trash2, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { Button, Card, Chip, Section, Switch } from '@/components/ui';
import { useRejections } from '@/data/hooks';
import { repo } from '@/data/repo';
import { useSetting } from '@/data/settings';
import { BUILT_IN_OCCASIONS } from '@/domain/occasions';
import { format } from 'date-fns';
import { uid } from '@/lib/id';

const TYPE_LABELS = { outfit: 'Outfit', pair: 'Pair', colors: 'Colors', item: 'Item' };

export function SuggestionSettings() {
  const [days, setDays] = useSetting('prefs.rotationDays');
  const [history, setHistory] = useSetting('prefs.useHistory');
  const [custom, setCustom] = useSetting('occasions.custom');
  const rejections = useRejections();
  const [name, setName] = useState('');
  const [base, setBase] = useState('casual');
  return (
    <>
      <Section title="Suggestions">
        <Card>
          <div className="flex min-h-14 items-center justify-between gap-3">
            <div><div className="text-[15px]">Avoid repeats</div><div className="text-sm text-muted">Move items worn in the last {days} day{days === 1 ? '' : 's'} down</div></div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer days" onClick={() => setDays(Math.max(0, days - 1))} className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2"><Minus size={16} /></button>
              <span className="w-6 text-center tabular-nums">{days}</span>
              <button type="button" aria-label="More days" onClick={() => setDays(Math.min(14, days + 1))} className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2"><Plus size={16} /></button>
            </div>
          </div>
          <Switch label="Use my history" description="Outfits you wore, rated or liked nudge similar ones up or down" checked={history} onChange={setHistory} />
        </Card>
      </Section>
      <Section title={`Rejections (${rejections?.length ?? 0})`}>
        <div id="rejections" />
        <Card>
          {!rejections?.length ? <p className="text-sm text-muted">Nothing rejected. Tap Reject on any suggestion to hide it for good.</p> : (
            <ul>
              <AnimatePresence initial={false}>
                {rejections.map((r) => (
                  <motion.li key={r.id} layout exit={{ opacity: 0, x: 40 }} className="flex min-h-14 items-center gap-3 border-b border-line last:border-b-0">
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted">{TYPE_LABELS[r.type]}</span>
                    <span className="flex-1 text-sm"><span className="block">{r.label}</span><span className="block text-xs text-faint">{format(r.createdAt, 'd MMM yyyy')}</span></span>
                    <Button size="sm" icon={<Undo2 size={16} />} onClick={async () => { await repo.removeRejection(r.id); toast('Undone: it can show up again'); }}>Undo</Button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </Section>
      <Section title="My occasions">
        <Card>
          {custom.map((c) => (
            <div key={c.id} className="flex min-h-12 items-center justify-between border-b border-line">
              <span>{c.name} <span className="text-sm text-faint">like {BUILT_IN_OCCASIONS.find((o) => o.id === c.baseId)?.name}</span></span>
              <button type="button" aria-label={`Delete ${c.name}`} className="grid size-11 place-items-center text-muted" onClick={() => setCustom(custom.filter((x) => x.id !== c.id))}><Trash2 size={16} /></button>
            </div>
          ))}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New occasion, e.g. Temple visit" aria-label="New occasion name" className="mt-3 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none" />
          <div className="mt-2 text-sm text-muted">Dress like</div>
          <div className="no-scrollbar -mx-4 mt-1 flex gap-2 overflow-x-auto px-4">{BUILT_IN_OCCASIONS.map((o) => <Chip key={o.id} selected={base === o.id} onClick={() => setBase(o.id)}>{o.short}</Chip>)}</div>
          <Button size="sm" className="mt-3" disabled={!name.trim()} onClick={() => { setCustom([...custom, { id: uid('occ'), name: name.trim().slice(0, 30), baseId: base }]); setName(''); }}>Add occasion</Button>
        </Card>
      </Section>
    </>
  );
}
