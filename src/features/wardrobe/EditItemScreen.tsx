import { ChevronLeft, ImagePlus, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ItemDraft } from '@/ai/normalize';
import { useAiReady, useCatalog } from '@/app/hooks';
import { Photo } from '@/components/media';
import { toast } from '@/components/toast';
import { Button, Empty, IconButton } from '@/components/ui';
import { forgetPhotoUrl } from '@/data/hooks';
import { repo } from '@/data/repo';
import type { ExtractedColor } from '@/lib/colorExtract';
import { blobToCanvas, makeStoredImages } from '@/lib/image';
import { analyzePhoto, preparePhoto } from './analyze';
import { ItemForm } from './ItemForm';

export function EditItemScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, custom, loading } = useCatalog();
  const aiReady = useAiReady();
  const item = id ? byId.get(id) : undefined;
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item && !draft) {
      setDraft({ type: item.type, name: item.name, nameEdited: true, primaryShade: item.primaryShade, secondaryShade: item.secondaryShade, attrs: item.attrs, formality: item.formality, warmth: item.warmth, formalityManual: item.formalityManual, quantity: item.quantity, overrides: item.overrides, source: item.source });
    }
  }, [item, draft]);
  useEffect(() => () => { if (newPhoto) URL.revokeObjectURL(newPhoto.url); }, [newPhoto]);

  if (loading) return null;
  if (!item || !draft) return <Empty title="Item not found"><Button onClick={() => navigate('/wardrobe')}>Back to wardrobe</Button></Empty>;

  const analyze = async (blob: Blob, useAi: boolean) => {
    setBusy(true);
    try {
      const a = await analyzePhoto(blob, { useAi });
      setColors(a.colors);
      if (useAi && a.via !== 'manual') setDraft({ ...a.draft, quantity: draft.quantity, overrides: draft.overrides });
      if (a.problem) toast(a.problem.message);
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft.type || !draft.primaryShade) return;
    setBusy(true);
    try {
      let photoId = item.photoId;
      if (newPhoto) {
        const imgs = await makeStoredImages(await blobToCanvas(newPhoto.blob, 1600));
        photoId = await repo.savePhoto({ ...imgs, kind: 'item' });
        if (item.photoId) { await repo.deletePhoto(item.photoId); forgetPhotoUrl(item.photoId); }
      }
      await repo.updateItem(item.id, {
        name: draft.name.trim() || item.name, type: draft.type, primaryShade: draft.primaryShade, secondaryShade: draft.secondaryShade,
        attrs: draft.attrs, formality: draft.formality, warmth: draft.warmth, formalityManual: draft.formalityManual, quantity: draft.quantity, overrides: draft.overrides, photoId,
      });
      toast('Saved');
      navigate(-1);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col pt-safe">
      <header className="flex min-h-16 items-center gap-2 px-4">
        <IconButton label="Back" onClick={() => navigate(-1)}><ChevronLeft /></IconButton>
        <h1 className="text-lg font-semibold tracking-tight">Edit item</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4">
        <div className="relative mx-auto aspect-[4/5] max-h-[40dvh] overflow-hidden rounded-3xl border border-line bg-surface-2">
          {newPhoto ? <img src={newPhoto.url} alt={draft.name} className="absolute inset-0 size-full object-cover" /> : <Photo photoId={item.photoId} size="full" alt={item.name} className="absolute inset-0 size-full" />}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" icon={<ImagePlus size={16} />} onClick={() => input.current?.click()}>Replace photo</Button>
          {aiReady && newPhoto && <Button size="sm" icon={<Sparkles size={16} />} disabled={busy} onClick={() => analyze(newPhoto.blob, true)}>Analyze with AI</Button>}
          <input ref={input} type="file" accept="image/*" hidden onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            const blob = await preparePhoto(f);
            setNewPhoto({ blob, url: URL.createObjectURL(blob) });
            await analyze(blob, false);
          }} />
        </div>
        <ItemForm draft={draft} onChange={setDraft} colors={colors} reveal={false} custom={custom} />
      </div>
      <footer className="border-t border-line bg-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="primary" className="w-full" disabled={busy || !draft.type || !draft.primaryShade} onClick={save}>Save changes</Button>
      </footer>
    </div>
  );
}
