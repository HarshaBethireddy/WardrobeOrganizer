import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronLeft, EyeOff, Shirt, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAiReady, useCatalog, useEngineInput, useOnline, useWeather } from '@/app/hooks';
import { flyToLog } from '@/components/fly';
import { toast } from '@/components/toast';
import { Banner, Button, Chip, Empty, IconButton, Skeleton } from '@/components/ui';
import { useSetting } from '@/data/settings';
import { resolveOccasion } from '@/domain/occasions';
import { SLOT_LABELS } from '@/domain/types';
import { engine } from '@/engine/client';
import { paginate } from '@/engine/generator';
import type { GenerateResult, ScoredOutfit } from '@/engine/types';
import { todayStr } from '@/lib/dates';
import { ATTRIBUTION, snapshot } from '@/weather/weather';
import { OutfitCard } from './OutfitCard';
import { DateRow, OccasionChips, WeatherChip } from './pickers';
import { RejectSheet } from './RejectSheet';
import { reviewWithCache } from './review';
import { WearSheet } from './WearSheet';

export function SuggestScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const occasionId = params.get('occasion') ?? 'casual';
  const date = params.get('date') ?? todayStr();
  const include = useMemo(() => (params.get('include') ?? '').split(',').filter(Boolean), [params]);
  const exclude = useMemo(() => (params.get('exclude') ?? '').split(',').filter(Boolean), [params]);
  const asked = params.get('q');
  const { byId, custom, occasions, active } = useCatalog();
  const occ = resolveOccasion(occasionId, custom);
  const wx = useWeather(date);
  const day = wx?.status === 'ok' ? wx.day : null;
  const input = useEngineInput(occasionId, date, day, { include, exclude });
  const aiReady = useAiReady();
  const online = useOnline();
  const [reviewOn] = useSetting('ai.review');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [reviewed, setReviewed] = useState<ScoredOutfit[] | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [pages, setPages] = useState(1);
  const [worn, setWorn] = useState<Set<string>>(new Set());
  const [wearing, setWearing] = useState<{ o: ScoredOutfit; rect?: DOMRect; img?: string } | null>(null);
  const [rejecting, setRejecting] = useState<ScoredOutfit | null>(null);
  const weatherReady = wx !== null;

  useEffect(() => {
    if (!input || !weatherReady) return;
    let live = true;
    engine().generate(input).then((r) => {
      if (!live) return;
      setResult(r);
      setReviewed((prev) => (prev ? prev.filter((o) => r.outfits.some((x) => x.id === o.id)).map((o) => ({ ...r.outfits.find((x) => x.id === o.id)!, aiReason: o.aiReason, aiConcern: o.aiConcern })) : prev));
    });
    return () => { live = false; };
  }, [input, weatherReady]);

  const reviewKey = result ? `${occasionId}|${date}|${result.outfits.slice(0, 15).map((o) => o.id).join(';')}` : '';
  useEffect(() => {
    setReviewed(null);
    if (!result || !reviewOn || !aiReady || !online || !result.outfits.length || result.relaxed) return;
    let live = true;
    setReviewing(true);
    reviewWithCache(result.outfits, occ, day, byId).then((r) => { if (live) { setReviewed(r); setReviewing(false); } });
    return () => { live = false; setReviewing(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewKey, reviewOn, aiReady, online]);

  const list = reviewed ?? result?.outfits ?? [];
  const pageList = paginate(list, 6);
  const shown = pageList.slice(0, pages).flat();
  const setParam = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); setPages(1); };

  return (
    <div className="px-4 pt-safe">
      <header className="flex min-h-16 items-center gap-2">
        <IconButton label="Back" onClick={() => navigate('/ask')}><ChevronLeft /></IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Outfits for {occ.name.toLowerCase()}</h1>
          {asked && <p className="truncate text-sm text-faint">You asked: {asked}</p>}
        </div>
      </header>
      <OccasionChips value={occasionId} occasions={occasions} onChange={(id) => setParam('occasion', id)} />
      <div className="mt-2 flex flex-wrap items-center gap-2"><DateRow value={date} onChange={(d) => setParam('date', d)} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <WeatherChip state={wx} />
        {reviewing && <span className="shimmer inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm"><Sparkles size={14} />Stylist reviewing</span>}
        {!reviewing && reviewed && <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-sm text-black"><Sparkles size={14} />Stylist reviewed</motion.span>}
      </div>
      {(include.length > 0 || exclude.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {include.map((id) => <Chip key={id} selected onClick={() => setParam('include', include.filter((x) => x !== id).join(',') || null)}>With {byId.get(id)?.name ?? 'item'} <X size={14} /></Chip>)}
          {exclude.map((id) => <Chip key={id} onClick={() => setParam('exclude', exclude.filter((x) => x !== id).join(',') || null)}>Without {byId.get(id)?.name ?? 'item'} <X size={14} /></Chip>)}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {result?.includeProblems.map((p) => <Banner key={p} tone="warn" icon={<TriangleAlert size={18} />}>{p}</Banner>)}
        {result?.relaxed && (
          <Banner tone="warn" icon={<TriangleAlert size={18} />}>
            Nothing in your wardrobe fully fits {occ.name.toLowerCase()}. Closest options ({result.relaxed}).
          </Banner>
        )}
        {result && result.missing.length > 0 && (
          <Banner icon={<Shirt size={18} />}>To complete {occ.short.toLowerCase()} looks you'd need {result.missing.map((m) => `${m.hint} (${SLOT_LABELS[m.slot].toLowerCase()})`).join(', ')}.</Banner>
        )}
      </div>

      {!result ? (
        <div className="mt-4 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-[26rem] rounded-[28px]" />)}</div>
      ) : !active.length ? (
        <Empty icon={<Shirt size={26} />} title="Add some clothes first"><Button className="mt-4" variant="primary" onClick={() => navigate('/wardrobe/add')}>Add clothes</Button></Empty>
      ) : !list.length ? (
        <Empty title="No outfits to show">{result.hiddenByRejections ? 'Your rejections hide every option. You can undo them in Settings.' : 'Try another occasion or date.'}</Empty>
      ) : (
        <LayoutGroup>
          <div className="mt-4 space-y-4">
            <AnimatePresence mode="popLayout" initial={true}>
              {shown.map((o, i) => (
                <OutfitCard key={o.id} outfit={o} byId={byId} index={i % 6} worn={worn.has(o.id)}
                  onWear={(rect, img) => setWearing({ o, rect, img })} onReject={() => setRejecting(o)} />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}
      {pageList.length > pages && <Button className="mt-4 w-full" onClick={() => setPages(pages + 1)}>Show more</Button>}
      {result && result.hiddenByRejections > 0 && (
        <Link to="/settings#rejections" className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm text-muted"><EyeOff size={15} />{result.hiddenByRejections} hidden by your rejections</Link>
      )}
      {wx?.status === 'ok' && <p className="mt-2 mb-4 text-center text-xs text-faint"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{ATTRIBUTION}</a></p>}

      {wearing && (
        <WearSheet open onClose={() => setWearing(null)} slots={wearing.o.slots} occasionId={occasionId} date={date} source="suggestion"
          weather={(d) => (d === date && wx ? snapshot(wx) : undefined)}
          onSaved={(entry) => {
            const w = wearing;
            setWearing(null);
            setWorn((s) => new Set(s).add(w.o.id));
            setTimeout(() => flyToLog(w.rect, w.img), 220);
            toast('Saved to your log', { action: { label: 'View', run: () => navigate(`/log/${entry.id}`) } });
          }} />
      )}
      {rejecting && <RejectSheet open onClose={() => setRejecting(null)} slots={rejecting.slots} byId={byId} />}
    </div>
  );
}
