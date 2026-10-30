import { Ban, Heart, Sparkles, TriangleAlert, WandSparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { checkOutfit, type CheckOpinion } from '@/ai/stylist';
import { userMessage } from '@/ai/errors';
import { useAiReady, useCatalog, useEngineInput, useOnline, useWeather } from '@/app/hooks';
import { flyToLog } from '@/components/fly';
import { toast } from '@/components/toast';
import { Button, Card, CountUp, Empty } from '@/components/ui';
import { repo } from '@/data/repo';
import { resolveOccasion } from '@/domain/occasions';
import type { OutfitSlots, Slot } from '@/domain/types';
import { SLOT_LABELS } from '@/domain/types';
import { engine } from '@/engine/client';
import type { Evaluation } from '@/engine/types';
import { haptic } from '@/lib/haptics';
import { todayStr } from '@/lib/dates';
import { createStore, useStore } from '@/lib/store';
import { snapshot } from '@/weather/weather';
import { PATTERN_LABELS, ReasonList, scoreWord } from '@/features/suggest/OutfitCard';
import { DateRow, OccasionChips, WeatherChip } from '@/features/suggest/pickers';
import { RejectSheet } from '@/features/suggest/RejectSheet';
import { WearSheet } from '@/features/suggest/WearSheet';
import { SlotButton, SlotPicker } from './SlotPicker';

export const checkState = createStore<{ slots: OutfitSlots; occasionId: string; date: string }>({ slots: {}, occasionId: 'casual', date: todayStr() });
const SLOTS: { slot: Slot; optional: boolean }[] = [
  { slot: 'base', optional: false }, { slot: 'mid', optional: true }, { slot: 'outer', optional: true }, { slot: 'bottom', optional: false }, { slot: 'shoes', optional: true },
];
export function CheckScreen() {
  const navigate = useNavigate();
  const st = useStore(checkState);
  const { items, active, byId, custom, occasions } = useCatalog();
  const occ = resolveOccasion(st.occasionId, custom);
  const wx = useWeather(st.date);
  const day = wx?.status === 'ok' ? wx.day : null;
  const input = useEngineInput(st.occasionId, st.date, day);
  const aiReady = useAiReady();
  const online = useOnline();
  const [picking, setPicking] = useState<Slot | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [opinion, setOpinion] = useState<CheckOpinion | null>(null);
  const [asking, setAsking] = useState(false);
  const [liked, setLiked] = useState(0);
  const [wearing, setWearing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const set = (patch: Partial<typeof st>) => checkState.set((s) => ({ ...s, ...patch }));
  const setSlot = (slot: Slot, id: string | undefined) => {
    const slots = { ...st.slots };
    if (id) slots[slot] = id; else delete slots[slot];
    set({ slots });
    setOpinion(null);
  };
  const slotsKey = JSON.stringify(st.slots);
  const complete = !!st.slots.base && !!st.slots.bottom;

  useEffect(() => {
    // Drop picks whose item was archived or deleted.
    const bad = (Object.entries(st.slots) as [Slot, string][]).filter(([, id]) => !byId.get(id) || byId.get(id)!.archived);
    if (bad.length && byId.size) { const slots = { ...st.slots }; bad.forEach(([s]) => delete slots[s]); set({ slots }); }
  }, [byId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!input || !complete) { setEvaluation(null); return; }
    let live = true;
    engine().evaluate(input, st.slots).then((ev) => live && setEvaluation(ev));
    return () => { live = false; };
  }, [input, slotsKey, complete]); // eslint-disable-line react-hooks/exhaustive-deps

  const askStylist = async () => {
    setAsking(true);
    try { setOpinion(await checkOutfit(st.slots, occ, day, items)); }
    catch (e) { toast(userMessage(e)); }
    finally { setAsking(false); }
  };
  const like = async () => {
    haptic([8, 30, 8]);
    setLiked((n) => n + 1);
    await repo.addLike({ slots: st.slots, occasionId: st.occasionId });
    toast('Liked. Similar outfits will rank higher.');
  };
  if (!active.length) {
    return <div className="px-4 pt-safe"><h1 className="pt-6 text-3xl font-semibold tracking-tight">Check my outfit</h1><Empty title="Add some clothes first"><Button className="mt-4" variant="primary" onClick={() => navigate('/wardrobe/add')}>Add clothes</Button></Empty></div>;
  }
  return (
    <div className="px-4 pt-safe pb-6">
      <header className="pt-6 pb-3">
        <h1 className="text-3xl font-semibold tracking-tight">Check my outfit</h1>
        <p className="mt-1 text-sm text-muted">Put an outfit together and see how it scores, and why.</p>
      </header>
      <OccasionChips value={st.occasionId} occasions={occasions} onChange={(occasionId) => set({ occasionId })} />
      <div className="mt-2 flex flex-wrap gap-2"><DateRow value={st.date} onChange={(date) => set({ date })} /><WeatherChip state={wx} /></div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {SLOTS.map(({ slot, optional }) => <SlotButton key={slot} slot={slot} optional={optional || (slot === 'shoes' && occ.templates.includes('basic-noshoes'))} item={st.slots[slot] ? byId.get(st.slots[slot]!) : undefined} onClick={() => setPicking(slot)} />)}
      </div>

      {complete && evaluation && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mt-4">
            <div className="flex items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-white text-2xl font-semibold"><CountUp value={evaluation.score} /></div>
              <div>
                <div className="text-lg font-medium">{scoreWord(evaluation.score)}</div>
                <div className="text-sm text-muted">{PATTERN_LABELS[evaluation.pattern] ?? evaluation.pattern} {'\u00b7'} for {occ.name.toLowerCase()}</div>
              </div>
            </div>
            <div className="mt-4"><ReasonList outfit={{ reasons: evaluation.reasons }} max={5} /></div>
            {evaluation.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-warn">{evaluation.warnings.map((w) => <li key={w} className="flex gap-2"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{w}</li>)}</ul>
            )}
          </Card>
          {opinion && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="mt-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-faint"><Sparkles size={15} />Stylist</div>
                <p>{opinion.opinion}</p>
                {opinion.swap && byId.get(opinion.swap.itemId) && (
                  <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-3 text-sm">
                    <p>Try <span className="font-medium">{byId.get(opinion.swap.itemId)!.name}</span> as the {SLOT_LABELS[opinion.swap.slot].toLowerCase()}{opinion.swap.reason ? `: ${opinion.swap.reason}` : '.'}</p>
                    <Button size="sm" className="mt-2" onClick={() => setSlot(opinion.swap!.slot, opinion.swap!.itemId)}>Apply swap</Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
          <div className="mt-3 grid gap-2">
            {aiReady && online && <Button icon={<WandSparkles size={18} />} disabled={asking} onClick={askStylist}>{asking ? 'Asking\u2026' : 'Ask stylist'}</Button>}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="primary" tick onClick={() => setWearing(true)}>Wear this</Button>
              <Button onClick={like} icon={<motion.span key={liked} initial={liked ? { scale: 1.6 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 10 }}><Heart size={18} className={liked ? 'fill-white' : ''} /></motion.span>}>I like this</Button>
              <Button icon={<Ban size={18} />} onClick={() => setRejecting(true)}>Reject</Button>
            </div>
          </div>
        </motion.div>
      )}
      {!complete && <p className="mt-4 text-center text-sm text-faint">Pick at least a top and a bottom to see the score.</p>}

      {picking && <SlotPicker slot={picking} open onClose={() => setPicking(null)} items={items} value={st.slots[picking]} optional={SLOTS.find((s) => s.slot === picking)!.optional || picking === 'shoes'} onPick={(id) => setSlot(picking, id)} />}
      {wearing && (
        <WearSheet open onClose={() => setWearing(false)} slots={st.slots} occasionId={st.occasionId} date={st.date} source="check"
          weather={(d) => (d === st.date && wx ? snapshot(wx) : undefined)}
          onSaved={(entry) => { setWearing(false); flyToLog(document.querySelector('main')?.getBoundingClientRect()); toast('Saved to your log', { action: { label: 'View', run: () => navigate(`/log/${entry.id}`) } }); }} />
      )}
      {rejecting && <RejectSheet open onClose={() => setRejecting(false)} slots={st.slots} byId={byId} />}
    </div>
  );
}
