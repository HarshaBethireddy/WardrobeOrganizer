import { ArrowUp, Shirt } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAiReady, useCatalog, useOnline, useWeather } from '@/app/hooks';
import { OccasionIcon } from '@/components/icons';
import { ItemTile } from '@/components/media';
import { Button, Chip, Segmented, Skeleton } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import { RateBanner } from '@/features/log/RateBanner';
import { WeatherChip } from '@/features/suggest/pickers';
import { addDaysStr, todayStr } from '@/lib/dates';
import { uid } from '@/lib/id';
import { createStore, useStore } from '@/lib/store';
import { EXAMPLE_QUESTIONS } from '@/query/parser';
import type { WardrobeRequest } from '@/query/types';
import { understand, type Understood } from '@/query/understand';
import { Bubble, EditRequestSheet, InterpretationChip, InventoryAnswer, LogAnswer, UnknownAnswer } from './answers';

interface Exchange { id: string; text: string; understood?: Understood }
export const conversation = createStore<Exchange[]>([]);

export function outfitUrl(r: Extract<WardrobeRequest, { kind: 'outfit' }>, q?: string) {
  const p = new URLSearchParams({ occasion: r.occasionId, date: r.date });
  if (r.include.length) p.set('include', r.include.join(','));
  if (r.exclude.length) p.set('exclude', r.exclude.join(','));
  if (q) p.set('q', q);
  return `/suggest?${p}`;
}

function OutfitAnswer({ r, text, onPick }: { r: Extract<WardrobeRequest, { kind: 'outfit' }>; text: string; onPick: (id: string) => void }) {
  const navigate = useNavigate();
  const { byId } = useCatalog();
  return (
    <div>
      {r.missing.map((m) => <p key={m} className="text-muted">You don't have {/^(a|an|my|the)\b/.test(m) ? m : `a ${m}`}, so it's left out.</p>)}
      {r.ambiguous.map((a) => (
        <div key={a.phrase} className="mt-2">
          <p className="text-lg">Which {a.phrase}?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">{a.candidates.map((id) => byId.get(id)).filter(Boolean).map((it) => <ItemTile key={it!.id} item={it!} onClick={() => onPick(it!.id)} />)}</div>
        </div>
      ))}
      <Button className="mt-3" variant="primary" onClick={() => navigate(outfitUrl(r, text))}>Show outfits</Button>
    </div>
  );
}

export function AskScreen() {
  const navigate = useNavigate();
  const list = useStore(conversation);
  const { items, active, custom, occasions } = useCatalog();
  const log = useLogEntries();
  const aiReady = useAiReady();
  const online = useOnline();
  const [text, setText] = useState('');
  const [when, setWhen] = useState<'today' | 'tomorrow'>('today');
  const [editing, setEditing] = useState<Exchange | null>(null);
  const date = when === 'today' ? todayStr() : addDaysStr(todayStr(), 1);
  const wx = useWeather(date);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [list.length]);

  const setUnderstood = (id: string, u: Understood) => conversation.set((l) => l.map((x) => (x.id === id ? { ...x, understood: u } : x)));
  const ask = async (q: string) => {
    const t = q.trim();
    if (!t) return;
    setText('');
    const ex: Exchange = { id: uid('x'), text: t };
    conversation.set((l) => [...l.slice(-19), ex]);
    const knownTags = [...new Set((log ?? []).flatMap((e) => e.tags))];
    const u = await understand(t, { items, custom, knownTags }, { useAi: aiReady && online });
    setUnderstood(ex.id, u);
    if (u.request.kind === 'outfit' && !u.request.ambiguous.length && !u.request.missing.length) navigate(outfitUrl(u.request, t));
  };

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col px-4 pt-safe">
      <header className="pt-6 pb-2">
        <h1 className="text-3xl font-semibold tracking-tight">What are we wearing?</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-56"><Segmented id="when" value={when} onChange={setWhen} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }]} /></div>
          <WeatherChip state={wx} />
        </div>
      </header>
      <div className="mt-2 space-y-3"><RateBanner /></div>
      {!active.length && (
        <button type="button" onClick={() => navigate('/wardrobe/add')} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
          <Shirt size={20} /><span className="flex-1 text-sm">Start by adding your clothes: one photo each.</span>
        </button>
      )}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {occasions.map((o, i) => (
          <motion.button key={o.id} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/suggest?occasion=${o.id}&date=${date}`)}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-xs">
            <OccasionIcon occasion={o} size={22} />{o.short}
          </motion.button>
        ))}
      </div>

      <div className="mt-6 flex-1 space-y-4 pb-28">
        {!list.length && (
          <div>
            <p className="mb-2 text-sm text-faint">Ask anything about your clothes</p>
            <div className="flex flex-wrap gap-2">{EXAMPLE_QUESTIONS.map((q) => <Chip key={q} onClick={() => ask(q)}>{q}</Chip>)}</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {list.map((x) => (
            <motion.div key={x.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <Bubble>{x.text}</Bubble>
              {!x.understood ? (
                <div className="space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /></div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line bg-surface p-4">
                  <div className="mb-3"><InterpretationChip u={x.understood} onEdit={() => setEditing(x)} /></div>
                  {x.understood.request.kind === 'inventory' && <InventoryAnswer req={x.understood.request} />}
                  {x.understood.request.kind === 'log' && <LogAnswer req={x.understood.request} />}
                  {x.understood.request.kind === 'unknown' && <UnknownAnswer onAsk={ask} />}
                  {x.understood.request.kind === 'outfit' && (
                    <OutfitAnswer r={x.understood.request} text={x.text} onPick={(id) => {
                      const r = x.understood!.request as Extract<WardrobeRequest, { kind: 'outfit' }>;
                      navigate(outfitUrl({ ...r, include: [...r.include, id], ambiguous: [] }, x.text));
                    }} />
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl bg-gradient-to-t from-black via-black/95 to-transparent px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 pl-5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Office tomorrow, or how many white shirts?" aria-label="Ask" enterKeyHint="send" className="min-h-12 flex-1 bg-transparent outline-none placeholder:text-faint" />
          <motion.button type="submit" aria-label="Send" whileTap={{ scale: 0.9 }} disabled={!text.trim()} className="mr-1 grid size-11 place-items-center rounded-full bg-white text-black disabled:bg-white/30"><ArrowUp size={20} /></motion.button>
        </div>
      </form>
      {editing?.understood && (
        <EditRequestSheet open onClose={() => setEditing(null)} request={editing.understood.request}
          onApply={(r) => {
            setUnderstood(editing.id, { ...editing.understood!, request: r, via: 'keywords' });
            if (r.kind === 'outfit') navigate(outfitUrl(r, editing.text));
          }} />
      )}
    </div>
  );
}
