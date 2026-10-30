import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCatalog } from '@/app/hooks';
import { Photo } from '@/components/media';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, Section } from '@/components/ui';
import { forgetPhotoUrl } from '@/data/hooks';
import { repo } from '@/data/repo';
import type { LogEntry } from '@/domain/types';
import { blobToCanvas, makeStoredImages } from '@/lib/image';

const field = 'min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none focus:border-white/40';

export function EditLogSheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry: LogEntry }) {
  const { occasions } = useCatalog();
  const [date, setDate] = useState(entry.date);
  const [occ, setOcc] = useState(entry.occasionId);
  const [tags, setTags] = useState(entry.tags.join(', '));
  const [note, setNote] = useState(entry.note ?? '');
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setDate(entry.date); setOcc(entry.occasionId); setTags(entry.tags.join(', ')); setNote(entry.note ?? ''); setSelfie(null); } }, [open, entry]);
  const save = async () => {
    setBusy(true);
    try {
      let selfieId = entry.selfieId;
      if (selfie && entry.selfieId) { await repo.deletePhoto(entry.selfieId); forgetPhotoUrl(entry.selfieId); selfieId = undefined; }
      if (selfie && selfie !== 'remove') {
        const imgs = await makeStoredImages(await blobToCanvas(selfie.blob, 1600), 1080, 320);
        selfieId = await repo.savePhoto({ ...imgs, kind: 'selfie' });
      }
      await repo.updateLogEntry(entry.id, { date, occasionId: occ, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), note: note.trim() || undefined, selfieId });
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Edit entry" footer={<Button variant="primary" className="w-full" disabled={busy || !date} onClick={save}>Save</Button>}>
      <Section title="Date" className="mt-2"><input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></Section>
      <Section title="Occasion"><div className="flex flex-wrap gap-2">{occasions.map((o) => <Chip key={o.id} selected={occ === o.id} onClick={() => setOcc(o.id)}>{o.short}</Chip>)}</div></Section>
      <Section title="Tags (comma separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} aria-label="Tags" className={field} /></Section>
      <Section title="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Note" className={`${field} py-3`} /></Section>
      <Section title="Selfie">
        <div className="flex items-center gap-3">
          {selfie && selfie !== 'remove' ? <img src={selfie.url} alt="New selfie" className="h-28 w-20 rounded-xl object-cover" />
            : entry.selfieId && selfie !== 'remove' ? <Photo photoId={entry.selfieId} alt="Selfie" className="h-28 w-20 rounded-xl" /> : null}
          <div className="grid gap-2">
            <Button size="sm" icon={<Camera size={16} />} onClick={() => cam.current?.click()}>{entry.selfieId ? 'Replace' : 'Add selfie'}</Button>
            {(entry.selfieId || (selfie && selfie !== 'remove')) && selfie !== 'remove' && <Button size="sm" icon={<X size={16} />} onClick={() => setSelfie('remove')}>Remove</Button>}
          </div>
          <input ref={cam} type="file" accept="image/*" capture="user" hidden onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) setSelfie({ blob: f, url: URL.createObjectURL(f) }); }} />
        </div>
      </Section>
    </Sheet>
  );
}
