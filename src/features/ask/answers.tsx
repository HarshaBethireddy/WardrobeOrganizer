import { Pencil, Sparkles, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useCatalog } from '@/app/hooks';
import { ItemTile } from '@/components/media';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, CountUp, Section, Segmented } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import { FAMILIES } from '@/domain/palette';
import { CATEGORIES } from '@/domain/taxonomy';
import type { Category } from '@/domain/types';
import { LogCard } from '@/features/log/LogCard';
import { DateRow, OccasionChips } from '@/features/suggest/pickers';
import { groupByCategory, isEmptyFilter, queryItems } from '@/query/inventory';
import { EXAMPLE_QUESTIONS } from '@/query/parser';
import type { WardrobeRequest } from '@/query/types';
import { describeRequest, filterText, type Understood } from '@/query/understand';

export function InterpretationChip({ u, onEdit }: { u: Understood; onEdit: () => void }) {
  const { custom } = useCatalog();
  return (
    <button type="button" onClick={onEdit} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm text-muted" aria-label="Edit how this was understood">
      {u.via === 'ai' ? <Sparkles size={14} /> : <WifiOff size={14} />}
      <span>Understood as: <span className="text-fg">{describeRequest(u.request, custom)}</span></span>
      <Pencil size={13} />
    </button>
  );
}

export function InventoryAnswer({ req }: { req: Extract<WardrobeRequest, { kind: 'inventory' }> }) {
  const { items, custom } = useCatalog();
  const [, setParams] = useSearchParams();
  const r = queryItems(items, req.filter, custom);
  const what = isEmptyFilter(req.filter) ? 'pieces' : filterText(req.filter).toLowerCase();
  return (
    <div>
      <p className="text-lg">
        {r.count === 0 ? <>You don't have any {what}.</> : <>You have <CountUp value={r.count} className="font-semibold" /> {what}{r.items.length !== r.count ? ` (${r.items.length} different)` : ''}.</>}
      </p>
      {groupByCategory(r.items).map((g) => (
        <div key={g.category} className="mt-3">
          <div className="mb-1.5 text-xs uppercase tracking-[0.12em] text-faint">{CATEGORIES.find((c) => c.id === g.category)?.plural}</div>
          <div className="grid grid-cols-3 gap-2">
            {g.items.map((it) => <ItemTile key={it.id} item={it} onClick={() => setParams({ item: it.id })} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LogAnswer({ req }: { req: Extract<WardrobeRequest, { kind: 'log' }> }) {
  const log = useLogEntries();
  const { byId, custom } = useCatalog();
  const found = (log ?? []).filter((e) => e.date >= req.from && e.date <= req.to && (!req.occasionId || e.occasionId === req.occasionId)
    && (!req.tags.length || req.tags.some((t) => e.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())))
    && (!req.itemIds.length || req.itemIds.some((id) => Object.values(e.slots).includes(id))));
  return (
    <div>
      <p className="text-lg">{found.length ? `You logged ${found.length} outfit${found.length === 1 ? '' : 's'}.` : 'Nothing logged for that time.'}</p>
      <div className="mt-3 space-y-3">{found.slice(0, 10).map((e, i) => <LogCard key={e.id} entry={e} byId={byId} custom={custom} index={i} />)}</div>
    </div>
  );
}

export function UnknownAnswer({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div>
      <p className="text-lg">I didn't catch that. Try one of these:</p>
      <div className="mt-3 flex flex-wrap gap-2">{EXAMPLE_QUESTIONS.map((q) => <Chip key={q} onClick={() => onAsk(q)}>{q}</Chip>)}</div>
    </div>
  );
}

/** Edits the interpretation and re-runs it. */
export function EditRequestSheet({ open, onClose, request, onApply }: { open: boolean; onClose: () => void; request: WardrobeRequest; onApply: (r: WardrobeRequest) => void }) {
  const { occasions } = useCatalog();
  const [r, setR] = useState<WardrobeRequest>(request);
  const field = 'min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none';
  return (
    <Sheet open={open} onClose={onClose} title="Change the question" footer={<Button variant="primary" className="w-full" onClick={() => { onApply(r); onClose(); }}>Apply</Button>}>
      <Segmented id="kind" value={r.kind === 'unknown' ? 'inventory' : r.kind} onChange={(k) => setR(k === 'inventory' ? { kind: 'inventory', mode: 'list', filter: {} } : k === 'outfit' ? { kind: 'outfit', occasionId: 'casual', date: new Date().toISOString().slice(0, 10), include: [], exclude: [], ambiguous: [], missing: [] } : { kind: 'log', from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), tags: [], itemIds: [] })}
        options={[{ value: 'inventory', label: 'My clothes' }, { value: 'outfit', label: 'Outfit' }, { value: 'log', label: 'What I wore' }]} />
      {r.kind === 'inventory' && (
        <>
          <Section title="Show">
            <Segmented id="mode" value={r.mode} onChange={(mode) => setR({ ...r, mode })} options={[{ value: 'list', label: 'List' }, { value: 'count', label: 'Count' }]} />
          </Section>
          <Section title="Category">
            <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => {
              const on = r.filter.categories?.includes(c.id) ?? false;
              return <Chip key={c.id} selected={on} onClick={() => setR({ ...r, filter: { ...r.filter, types: undefined, categories: on ? r.filter.categories!.filter((x) => x !== c.id) : [...(r.filter.categories ?? []), c.id as Category] } })}>{c.plural}</Chip>;
            })}</div>
          </Section>
          <Section title="Color">
            <div className="flex flex-wrap gap-2">{FAMILIES.map((f) => {
              const on = r.filter.families?.includes(f.id) ?? false;
              return <Chip key={f.id} swatch={f.hex} selected={on} onClick={() => setR({ ...r, filter: { ...r.filter, shades: undefined, families: on ? r.filter.families!.filter((x) => x !== f.id) : [...(r.filter.families ?? []), f.id] } })}>{f.label}</Chip>;
            })}</div>
          </Section>
        </>
      )}
      {r.kind === 'outfit' && (
        <>
          <Section title="Occasion"><OccasionChips value={r.occasionId} occasions={occasions} onChange={(occasionId) => setR({ ...r, occasionId })} /></Section>
          <Section title="Date"><DateRow value={r.date} onChange={(date) => setR({ ...r, date })} /></Section>
        </>
      )}
      {r.kind === 'log' && (
        <Section title="Dates">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="From" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} className={field} />
            <input type="date" aria-label="To" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} className={field} />
          </div>
        </Section>
      )}
    </Sheet>
  );
}

export function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-white px-4 py-2.5 text-black">{children}</motion.div>
  );
}
