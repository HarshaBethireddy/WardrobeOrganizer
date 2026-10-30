import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useCatalog } from '@/app/hooks';
import { OccasionIcon, WeatherIcon } from '@/components/icons';
import { ItemTile, OutfitCollage, Photo } from '@/components/media';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/toast';
import { Button, Empty, IconButton, Section, Stars } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import { repo } from '@/data/repo';
import { resolveOccasion } from '@/domain/occasions';
import { SLOT_ORDER, type Item } from '@/domain/types';
import { longDate } from '@/lib/dates';
import { EditLogSheet } from './EditLogSheet';

export function LogDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const log = useLogEntries();
  const { byId, custom } = useCatalog();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const entry = log?.find((e) => e.id === id);
  if (!log) return null;
  if (!entry) return <Empty title="Entry not found"><Button className="mt-4" onClick={() => navigate('/log')}>Back to log</Button></Empty>;
  const occ = resolveOccasion(entry.occasionId, custom);
  const pieces = SLOT_ORDER.map((s) => (entry.slots[s] ? byId.get(entry.slots[s]!) : undefined)).filter((x): x is Item => !!x);
  return (
    <div className="px-4 pt-safe pb-8">
      <header className="flex min-h-16 items-center gap-2">
        <IconButton label="Back" onClick={() => navigate(-1)}><ChevronLeft /></IconButton>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{longDate(entry.date)}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted"><OccasionIcon occasion={occ} size={14} />{occ.name}</p>
        </div>
        <IconButton label="Edit entry" onClick={() => setEditing(true)}><Pencil size={20} /></IconButton>
      </header>
      <OutfitCollage slots={entry.slots} byId={byId} className="h-80" />
      {entry.selfieId && <div className="mt-3 overflow-hidden rounded-3xl border border-line"><Photo photoId={entry.selfieId} size="full" alt="Selfie" className="max-h-[70dvh] w-full" /></div>}
      {entry.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.tags.map((t) => <span key={t} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm">#{t}</span>)}</div>}
      {entry.note && <p className="mt-3 text-[15px]">{entry.note}</p>}
      {entry.weather && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <WeatherIcon code={entry.weather.code} />
          {`${Math.round(entry.weather.tMax)}\u00b0 / ${Math.round(entry.weather.tMin)}\u00b0${entry.weather.place ? ` \u00b7 ${entry.weather.place}` : ''}`}
        </p>
      )}
      <Section title="Rating"><Stars value={entry.rating} label="Rate this outfit" onChange={async (v) => { await repo.updateLogEntry(entry.id, { rating: v }); toast(`Rated ${v}\u2605`); }} /></Section>
      <Section title="Pieces">
        <div className="grid grid-cols-3 gap-2">{pieces.map((it) => <ItemTile key={it.id} item={it} onClick={() => setParams({ item: it.id })} />)}</div>
        {pieces.length < Object.keys(entry.slots).length && <p className="mt-2 text-sm text-faint">Some pieces were deleted from the wardrobe.</p>}
      </Section>
      <Button variant="danger" className="mt-8 w-full" icon={<Trash2 size={18} />} onClick={() => setConfirm(true)}>Delete entry</Button>
      <EditLogSheet open={editing} onClose={() => setEditing(false)} entry={entry} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete this entry?"
        footer={<div className="grid grid-cols-2 gap-2"><Button onClick={() => setConfirm(false)}>Keep</Button><Button variant="danger" onClick={async () => { await repo.deleteLogEntry(entry.id); toast('Entry deleted'); navigate('/log', { replace: true }); }}>Delete</Button></div>}>
        <p className="text-muted">The outfit, note and selfie for this day will be removed. This can't be undone.</p>
      </Sheet>
    </div>
  );
}
