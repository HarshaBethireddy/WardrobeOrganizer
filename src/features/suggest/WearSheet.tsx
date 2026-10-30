import { Camera, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '@/app/hooks';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, Section, Stars } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import { repo } from '@/data/repo';
import type { LogEntry, OutfitSlots, WeatherSnapshot } from '@/domain/types';
import { todayStr } from '@/lib/dates';
import { blobToCanvas, makeStoredImages } from '@/lib/image';

const field = 'min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none focus:border-white/40';

/** Saves the chosen outfit to the log with a date, tags, an optional note, selfie and rating. */
export function WearSheet({ open, onClose, slots, occasionId, date, source, weather, onSaved }: {
  open: boolean; onClose: () => void; slots: OutfitSlots; occasionId: string; date?: string; source: LogEntry['source'];
  weather?: (d: string) => WeatherSnapshot | undefined; onSaved: (e: LogEntry) => void;
}) {
  const { occasions } = useCatalog();
  const log = useLogEntries();
  const [d, setD] = useState(date ?? todayStr());
  const [occ, setOcc] = useState(occasionId);
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | undefined>();
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setD(date ?? todayStr()); setOcc(occasionId); setTags([]); setNote(''); setRating(undefined); setSelfie(null); } }, [open, date, occasionId]);
  const known = useMemo(() => [...new Set((log ?? []).flatMap((e) => e.tags))].slice(0, 12), [log]);
  const addTag = (t: string) => { const v = t.trim().replace(/^#/, ''); if (v && !tags.includes(v)) setTags([...tags, v]); setTagText(''); };

  const save = async () => {
    setBusy(true);
    try {
      let selfieId: string | undefined;
      if (selfie) {
        const imgs = await makeStoredImages(await blobToCanvas(selfie.blob, 1600), 1080, 320);
        selfieId = await repo.savePhoto({ ...imgs, kind: 'selfie' });
      }
      const pending = tagText.trim() ? [...tags, tagText.trim()] : tags;
      const entry = await repo.addLogEntry({ date: d, occasionId: occ, tags: pending, slots, note: note.trim() || undefined, selfieId, rating, source, weather: weather?.(d) });
      onSaved(entry);
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Wear this" footer={<Button variant="primary" className="w-full" tick disabled={busy || !d} onClick={save}>{busy ? 'Saving\u2026' : 'Save to log'}</Button>}>
      <Section title="Date" className="mt-2"><input type="date" aria-label="Date" value={d} onChange={(e) => setD(e.target.value)} className={field} /></Section>
      <Section title="Occasion">
        <div className="flex flex-wrap gap-2">{occasions.map((o) => <Chip key={o.id} selected={occ === o.id} onClick={() => setOcc(o.id)}>{o.short}</Chip>)}</div>
      </Section>
      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => <Chip key={t} selected onClick={() => setTags(tags.filter((x) => x !== t))}>{t} <X size={14} /></Chip>)}
        </div>
        <input value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagText); } }}
          placeholder="Add a tag, e.g. client meeting" aria-label="Add a tag" className={`${field} mt-2`} />
        {known.filter((t) => !tags.includes(t)).length > 0 && (
          <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">{known.filter((t) => !tags.includes(t)).map((t) => <Chip key={t} onClick={() => addTag(t)}>{t}</Chip>)}</div>
        )}
      </Section>
      <Section title="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" aria-label="Note" className={`${field} py-3`} />
      </Section>
      <Section title="Selfie">
        {selfie ? (
          <div className="relative w-32 overflow-hidden rounded-2xl border border-line">
            <img src={selfie.url} alt="Selfie" className="aspect-[3/4] w-full object-cover" />
            <button type="button" aria-label="Remove selfie" onClick={() => setSelfie(null)} className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-black/70"><X size={16} /></button>
          </div>
        ) : (
          <Button icon={<Camera size={18} />} onClick={() => cam.current?.click()}>Add a mirror selfie</Button>
        )}
        <input ref={cam} type="file" accept="image/*" capture="user" hidden onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) setSelfie({ blob: f, url: URL.createObjectURL(f) }); }} />
        <p className="mt-1 text-xs text-faint">Selfies stay on this phone. They are never sent to an AI.</p>
      </Section>
      <Section title="Rating (optional)"><Stars value={rating} onChange={setRating} label="Rate this outfit" /></Section>
    </Sheet>
  );
}
