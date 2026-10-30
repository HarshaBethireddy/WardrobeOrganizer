import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Crop, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ItemDraft } from '@/ai/normalize';
import { useAiReady, useCatalog } from '@/app/hooks';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/toast';
import { Banner, Button, IconButton, Skeleton } from '@/components/ui';
import { repo } from '@/data/repo';
import type { Item } from '@/domain/types';
import { defaultAttrs } from '@/domain/taxonomy';
import { haptic } from '@/lib/haptics';
import { blobToCanvas, makeStoredImages } from '@/lib/image';
import { uid } from '@/lib/id';
import { useStore } from '@/lib/store';
import { analyzePhoto, findDuplicate, preparePhoto, type Analysis } from './analyze';
import { CropSheet } from './CropSheet';
import { ItemForm, recompute } from './ItemForm';
import { pendingFiles } from './pending';
import { PhotoPickers } from './PhotoPickers';

interface Entry {
  key: string;
  file: File;
  photo?: Blob;
  url?: string;
  status: 'waiting' | 'analyzing' | 'ready';
  analysis?: Analysis;
  draft?: ItemDraft;
}

const VIA_LABEL = { ai: 'Tagged by AI', 'on-device': 'Tagged on this phone', manual: 'Tag by hand' };

export function AddItemScreen() {
  const navigate = useNavigate();
  const { active, custom } = useCatalog();
  const aiReady = useAiReady();
  const files = useStore(pendingFiles);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<Item | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const retake = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    // Take the picked photos exactly once (effects can run twice in development).
    const picked = pendingFiles.get();
    if (!picked.length) return;
    pendingFiles.set([]);
    setEntries((l) => [...l, ...picked.map((file) => ({ key: uid('e'), file, status: 'waiting' as const }))]);
  }, [files]);

  const update = useCallback((key: string, patch: Partial<Entry>) => setEntries((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x))), []);

  const run = useCallback(async (entry: Entry, useAi = true) => {
    update(entry.key, { status: 'analyzing' });
    try {
      const photo = entry.photo ?? (await preparePhoto(entry.file));
      const url = entry.url ?? URL.createObjectURL(photo);
      update(entry.key, { photo, url });
      const analysis = await analyzePhoto(photo, { useAi });
      update(entry.key, { status: 'ready', analysis, draft: analysis.draft });
    } catch {
      update(entry.key, { status: 'ready', analysis: { draft: recompute({ name: '', attrs: defaultAttrs('tshirt'), formality: 3, warmth: 2, quantity: 1, overrides: {}, source: 'manual' }), colors: [], via: 'manual', problem: { message: "This photo couldn't be read. Try another one." } } });
    }
  }, [update]);

  // Analyze photos one at a time so a bulk add stays light on memory and AI limits.
  useEffect(() => {
    if (busy.current) return;
    const next = entries.find((e) => e.status === 'waiting');
    if (!next) return;
    busy.current = true;
    run(next).finally(() => { busy.current = false; setEntries((l) => [...l]); });
  }, [entries, run]);

  useEffect(() => () => entries.forEach((e) => e.url && URL.revokeObjectURL(e.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = entries[index];
  const draft = cur?.draft;
  const done = () => { toast(entries.length > 1 ? 'All photos handled' : 'Saved to your wardrobe'); navigate('/wardrobe'); };
  const advance = () => {
    if (index + 1 < entries.length) setIndex(index + 1);
    else done();
  };
  const save = async (mode: 'check' | 'separate' | 'merge') => {
    if (!cur?.photo || !draft?.type || !draft.primaryShade) return;
    const existing = findDuplicate(active, draft);
    if (mode === 'check' && existing) { setDup(existing); return; }
    setSaving(true);
    try {
      if (mode === 'merge' && existing) {
        await repo.updateItem(existing.id, { quantity: existing.quantity + draft.quantity });
        toast(`${existing.name}: now ${existing.quantity + draft.quantity}`);
      } else {
        const imgs = await makeStoredImages(await blobToCanvas(cur.photo, 1600));
        const photoId = await repo.savePhoto({ ...imgs, kind: 'item' });
        await repo.addItem({
          name: draft.name.trim() || 'Item', type: draft.type, primaryShade: draft.primaryShade, secondaryShade: draft.secondaryShade,
          attrs: draft.attrs, formality: draft.formality, warmth: draft.warmth, quantity: draft.quantity, overrides: draft.overrides,
          photoId, source: draft.source, formalityManual: draft.formalityManual,
        });
        if (entries.length > 1) toast(`Saved ${draft.name}`);
      }
      haptic();
      setDup(null);
      advance();
    } finally {
      setSaving(false);
    }
  };

  const onCropped = async (blob: Blob) => {
    setCropOpen(false);
    if (!cur) return;
    if (cur.url) URL.revokeObjectURL(cur.url);
    const fixed: Entry = { ...cur, photo: blob, url: URL.createObjectURL(blob) };
    update(cur.key, { photo: fixed.photo, url: fixed.url });
    const hadProblem = cur.analysis?.problem?.kind === 'not-clothing' || cur.analysis?.problem?.kind === 'multiple-items';
    if (hadProblem) await run(fixed);
    else {
      const a = await analyzePhoto(blob, { useAi: false });
      update(cur.key, { analysis: { ...cur.analysis!, colors: a.colors }, draft: draft && !draft.primaryShade ? recompute({ ...draft, primaryShade: a.draft.primaryShade }) : draft });
    }
  };

  if (!entries.length) {
    return (
      <div className="px-4 pt-safe">
        <header className="flex min-h-16 items-center gap-2">
          <IconButton label="Back" onClick={() => navigate('/wardrobe')}><ChevronLeft /></IconButton>
          <h1 className="text-xl font-semibold tracking-tight">Add clothes</h1>
        </header>
        <p className="mt-2 mb-6 text-muted">One photo per item, any angle. Pick several photos to add them in one go.</p>
        <PhotoPickers onFiles={(f) => pendingFiles.set(f)} />
      </div>
    );
  }

  const analyzing = !cur || cur.status !== 'ready';
  const problem = cur?.analysis?.problem;
  return (
    <div className="flex min-h-dvh flex-col pt-safe">
      <header className="flex min-h-16 items-center gap-2 px-4">
        <IconButton label="Close" onClick={() => navigate('/wardrobe')}><ChevronLeft /></IconButton>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{entries.length > 1 ? `Item ${index + 1} of ${entries.length}` : 'New item'}</h1>
          {entries.length > 1 && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full bg-white" animate={{ width: `${((index + 1) / entries.length) * 100}%` }} />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="relative mx-auto aspect-[4/5] max-h-[48dvh] overflow-hidden rounded-3xl border border-line bg-surface-2">
          {cur?.url ? <img src={cur.url} alt="New item" className="absolute inset-0 size-full object-cover" /> : <Skeleton className="absolute inset-0 rounded-none" />}
          <AnimatePresence>
            {analyzing && (
              <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/30" />
                <div className="scanline absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-white/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm backdrop-blur"><Sparkles size={14} /> {aiReady ? 'Reading the photo\u2026' : 'Finding colors\u2026'}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!analyzing && cur?.analysis && (
            <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs backdrop-blur">{VIA_LABEL[cur.analysis.via]}{cur.analysis.provider ? ` \u00b7 ${cur.analysis.provider}` : ''}</span>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" icon={<Crop size={16} />} disabled={!cur?.photo} onClick={() => setCropOpen(true)}>Crop / rotate</Button>
          <Button size="sm" icon={<RefreshCw size={16} />} disabled={analyzing} onClick={() => retake.current?.click()}>Retake</Button>
          {aiReady && cur?.analysis?.via !== 'ai' && !analyzing && <Button size="sm" icon={<Sparkles size={16} />} onClick={() => cur && run(cur)}>Analyze again</Button>}
          <input ref={retake} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f || !cur) return;
            if (cur.url) URL.revokeObjectURL(cur.url);
            const fresh: Entry = { key: cur.key, file: f, status: 'waiting' };
            setEntries((l) => l.map((x) => (x.key === cur.key ? fresh : x)));
          }} />
        </div>
        {problem && !analyzing && <div className="mt-3"><Banner tone="warn" icon={<TriangleAlert size={18} />}>{problem.message}</Banner></div>}
        {analyzing || !draft ? (
          <div className="mt-6 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <ItemForm key={cur.key} draft={draft} onChange={(d) => update(cur.key, { draft: d })} colors={cur.analysis?.colors ?? []} reveal custom={custom} />
        )}
      </div>

      <footer className="flex gap-2 border-t border-line bg-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {entries.length > 1 && <Button className="flex-1" onClick={advance}>Skip</Button>}
        <Button variant="primary" className="flex-[2]" tick disabled={analyzing || saving || !draft?.type || !draft?.primaryShade} onClick={() => save('check')}>
          {saving ? 'Saving\u2026' : 'Save item'}
        </Button>
      </footer>

      <CropSheet open={cropOpen} src={cur?.url} photo={cur?.photo} onClose={() => setCropOpen(false)} onDone={onCropped} />
      <Sheet open={!!dup} onClose={() => setDup(null)} title="Looks like a duplicate"
        footer={<div className="grid gap-2"><Button variant="primary" onClick={() => save('merge')}>Add to its quantity</Button><Button onClick={() => save('separate')}>Save as a separate item</Button></div>}>
        <p className="text-muted">You already have <span className="text-fg">{dup?.name}</span> (same type, color and pattern). Add this one to its quantity instead?</p>
      </Sheet>
    </div>
  );
}
