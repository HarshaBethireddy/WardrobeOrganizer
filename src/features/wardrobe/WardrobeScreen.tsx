import { Ban, DatabaseBackup, Plus, Shirt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useCatalog } from '@/app/hooks';
import { ItemTile } from '@/components/media';
import { Sheet } from '@/components/Sheet';
import { Banner, Button, Chip, CountUp, Empty, IconButton, Skeleton } from '@/components/ui';
import { useRejections } from '@/data/hooks';
import { useSetting } from '@/data/settings';
import { FAMILIES, familyOf, type Family } from '@/domain/palette';
import { CATEGORIES } from '@/domain/taxonomy';
import type { Category } from '@/domain/types';
import { itemKey } from '@/engine/rejections';
import { groupByCategory, queryItems } from '@/query/inventory';
import { pendingFiles } from './pending';
import { PhotoPickers } from './PhotoPickers';

const BACKUP_REMIND_DAYS = 14;

export function BackupReminder() {
  const [lastAt, , loaded] = useSetting('backup.lastAt');
  const { active } = useCatalog();
  const navigate = useNavigate();
  if (!loaded || !active.length || Date.now() - lastAt < BACKUP_REMIND_DAYS * 86_400_000) return null;
  return (
    <Banner icon={<DatabaseBackup size={18} />} action={<Button size="sm" onClick={() => navigate('/settings#backup')}>Back up</Button>}>
      {lastAt ? `Last backup was over ${BACKUP_REMIND_DAYS} days ago.` : 'Your wardrobe lives only on this phone. Make a backup.'}
    </Banner>
  );
}

export function WardrobeScreen() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { items, loading } = useCatalog();
  const rejections = useRejections();
  const [cat, setCat] = useState<Category | null>(null);
  const [fam, setFam] = useState<Family | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const banned = useMemo(() => new Set((rejections ?? []).filter((r) => r.type === 'item').map((r) => r.key)), [rejections]);
  const result = useMemo(
    () => queryItems(items, { categories: cat ? [cat] : undefined, families: fam ? [fam] : undefined, includeArchived: showArchived }),
    [items, cat, fam, showArchived],
  );
  const shown = showArchived ? result.items.filter((i) => i.archived) : result.items;
  const familiesOwned = useMemo(() => FAMILIES.filter((f) => items.some((i) => !i.archived && familyOf(i.primaryShade) === f.id)), [items]);
  const onFiles = (files: File[]) => { setAdding(false); pendingFiles.set(files); navigate('/wardrobe/add'); };

  return (
    <div className="px-4 pt-safe">
      <header className="flex min-h-20 items-end justify-between pb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Wardrobe</h1>
          <p className="text-sm text-muted"><CountUp value={result.count} /> {result.count === 1 ? 'piece' : 'pieces'}{cat || fam ? ' match' : ''}</p>
        </div>
        <IconButton label="Add clothes" className="bg-white text-black" onClick={() => setAdding(true)}><Plus size={22} /></IconButton>
      </header>
      <BackupReminder />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip selected={!cat} onClick={() => setCat(null)}>All</Chip>
        {CATEGORIES.map((c) => <Chip key={c.id} selected={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.plural}</Chip>)}
      </div>
      {familiesOwned.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {familiesOwned.map((f) => <Chip key={f.id} swatch={f.hex} selected={fam === f.id} onClick={() => setFam(fam === f.id ? null : f.id)}>{f.label}</Chip>)}
          <Chip selected={showArchived} onClick={() => setShowArchived(!showArchived)}>Archived</Chip>
        </div>
      )}
      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
      ) : !items.length ? (
        <Empty icon={<Shirt size={26} />} title="Your wardrobe is empty">
          Add one photo per item. The app reads the type, color and details for you.
          <div className="mt-6"><PhotoPickers onFiles={onFiles} /></div>
        </Empty>
      ) : !shown.length ? (
        <Empty title="Nothing matches">Try another filter.</Empty>
      ) : (
        groupByCategory(shown).map((g) => (
          <section key={g.category} className="mt-6">
            <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-faint">
              {CATEGORIES.find((c) => c.id === g.category)?.plural} {'\u00b7'} {g.items.reduce((s, i) => s + i.quantity, 0)}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.items.map((it) => (
                <ItemTile key={it.id} item={it} layoutId={`item-${it.id}`} onClick={() => setParams({ item: it.id })}
                  badge={banned.has(itemKey(it.id)) ? <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-black/70 text-danger backdrop-blur" title="Never suggested"><Ban size={14} /></span> : undefined} />
              ))}
            </div>
          </section>
        ))
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add clothes">
        <p className="mb-4 text-sm text-muted">One photo per item, from any angle. Choose several photos to add them together.</p>
        <PhotoPickers onFiles={onFiles} />
        <div className="h-4" />
      </Sheet>
    </div>
  );
}
