import { motion } from 'motion/react';
import { Check, Minus, Plus, Ban } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ItemDraft } from '@/ai/normalize';
import { Chip, Section, Segmented, Switch } from '@/components/ui';
import { allOccasions } from '@/domain/occasions';
import { FAMILIES, SHADES, getShade } from '@/domain/palette';
import { ATTR_LABELS, CATEGORIES, FORMALITY_LABELS, ITEM_TYPES, WARMTH_LABELS, autoName, defaultAttrs, defaultFormality, defaultWarmth, findType, relevantAttrs } from '@/domain/taxonomy';
import type { AttrKey, Category, CustomOccasion, Item, ItemAttrs } from '@/domain/types';
import { checkItem } from '@/engine/filters';
import type { ExtractedColor } from '@/lib/colorExtract';
import { cn } from '@/lib/cn';

/** Recomputes the automatic name, formality and warmth unless the user set them. */
export function recompute(d: ItemDraft): ItemDraft {
  if (!d.type) return d;
  return {
    ...d,
    name: d.nameEdited ? d.name : autoName(d.type, d.primaryShade, d.attrs),
    formality: d.formalityManual ? d.formality : defaultFormality(d.type, d.attrs),
    warmth: d.formalityManual ? d.warmth : defaultWarmth(d.type, d.attrs),
  };
}

function Reveal({ i, children, on }: { i: number; children: ReactNode; on: boolean }) {
  return (
    <motion.div initial={on ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: on ? 0.08 * i : 0, duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

export function draftAsItem(d: ItemDraft): Item {
  return {
    id: 'draft', name: d.name || 'Item', type: d.type ?? 'tshirt', primaryShade: d.primaryShade ?? 'grey', secondaryShade: d.secondaryShade,
    attrs: d.attrs, formality: d.formality, warmth: d.warmth, quantity: d.quantity, overrides: d.overrides, archived: false,
    source: d.source, createdAt: 0, updatedAt: 0,
  };
}

export function ItemForm({ draft, onChange, colors, reveal, custom }: {
  draft: ItemDraft; onChange: (d: ItemDraft) => void; colors: ExtractedColor[]; reveal: boolean; custom: CustomOccasion[];
}) {
  const type = findType(draft.type);
  const [cat, setCat] = useState<Category>(type?.category ?? 'tops');
  const [shadeSlot, setShadeSlot] = useState<'primary' | 'secondary'>('primary');
  const set = (patch: Partial<ItemDraft>) => onChange(recompute({ ...draft, ...patch }));
  const setAttr = <K extends keyof ItemAttrs>(k: K, v: ItemAttrs[K]) => set({ attrs: { ...draft.attrs, [k]: v } });
  const pickType = (id: string) => {
    const attrs = { ...defaultAttrs(id), pattern: draft.attrs.pattern };
    onChange(recompute({ ...draft, type: id, attrs }));
  };
  const pickShade = (id: string) => {
    if (shadeSlot === 'primary') set({ primaryShade: id, secondaryShade: draft.secondaryShade === id ? undefined : draft.secondaryShade });
    else set({ secondaryShade: draft.secondaryShade === id ? undefined : id });
  };
  const occasions = allOccasions(custom);
  const asItem = draftAsItem({ ...draft, overrides: {} });
  let k = 0;

  return (
    <div className="pb-6">
      <Reveal i={k++} on={reveal}>
        <Section title="What is it?">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {CATEGORIES.map((c) => <Chip key={c.id} selected={cat === c.id} onClick={() => setCat(c.id)}>{c.plural}</Chip>)}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {ITEM_TYPES.filter((t) => t.category === cat).map((t) => (
              <Chip key={t.id} selected={draft.type === t.id} onClick={() => pickType(t.id)}>{t.label}</Chip>
            ))}
          </div>
          {!draft.type && <p className="mt-2 text-sm text-warn">Pick the type to continue.</p>}
        </Section>
      </Reveal>

      <Reveal i={k++} on={reveal}>
        <Section title="Name">
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value, nameEdited: true })}
            placeholder="e.g. Black zip jacket"
            aria-label="Name"
            className="min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none focus:border-white/40"
          />
        </Section>
      </Reveal>

      <Reveal i={k++} on={reveal}>
        <Section title="Color">
          <Segmented id="shade-slot" value={shadeSlot} onChange={setShadeSlot} options={[{ value: 'primary', label: `Main: ${getShade(draft.primaryShade)?.name ?? 'pick'}` }, { value: 'secondary', label: `Second: ${getShade(draft.secondaryShade)?.name ?? 'none'}` }]} />
          {colors.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Detected</span>
              {colors.map((c) => (
                <Chip key={c.shadeId} swatch={getShade(c.shadeId)?.hex} selected={(shadeSlot === 'primary' ? draft.primaryShade : draft.secondaryShade) === c.shadeId} onClick={() => pickShade(c.shadeId)}>
                  {getShade(c.shadeId)?.name} <span className="text-xs opacity-60">{Math.round(c.share * 100)}%</span>
                </Chip>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-7 gap-2">
            {SHADES.map((s) => {
              const on = (shadeSlot === 'primary' ? draft.primaryShade : draft.secondaryShade) === s.id;
              return (
                <motion.button key={s.id} type="button" whileTap={{ scale: 0.9 }} onClick={() => pickShade(s.id)} aria-label={s.name} aria-pressed={on} title={s.name}
                  className={cn('relative grid aspect-square min-h-11 place-items-center rounded-full border', on ? 'border-white ring-2 ring-white ring-offset-2 ring-offset-black' : 'border-white/15')}
                  style={{ background: s.hex }}>
                  {on && <Check size={16} className={s.family === 'white' || s.id.includes('light') || s.id === 'butter' || s.id === 'mint' || s.id === 'pink' ? 'text-black' : 'text-white'} />}
                </motion.button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-faint">Tap to correct. Photos taken in daylight on a plain background give the truest colors.</p>
          <div className="mt-1 text-xs text-faint">{FAMILIES.length} color families, {SHADES.length} shades.</div>
        </Section>
      </Reveal>
      {draft.type && (
        <Reveal i={k++} on={reveal}>
          <Section title="Details">
            <div className="space-y-3">
              {relevantAttrs(draft.type, draft.attrs).map((key: AttrKey) => (
                <div key={key}>
                  <div className="mb-1.5 text-sm text-muted">{ATTR_LABELS[key].label}</div>
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                    {Object.entries(ATTR_LABELS[key].values).filter(([v]) => v !== 'na').map(([v, label]) => (
                      <Chip key={v} selected={draft.attrs[key] === v} onClick={() => setAttr(key, v as never)}>{label}</Chip>
                    ))}
                  </div>
                </div>
              ))}
              {draft.type === 'shirt' && <Switch label="Can be worn open" description="Over a tee or tank top" checked={draft.attrs.canOpen} onChange={(v) => setAttr('canOpen', v)} />}
            </div>
          </Section>
        </Reveal>
      )}

      {draft.type && (
        <Reveal i={k++} on={reveal}>
          <Section title="How dressy and how warm">
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((f) => (
                <button key={f} type="button" aria-pressed={draft.formality === f} onClick={() => onChange({ ...draft, formality: f, formalityManual: true })}
                  className={cn('min-h-14 rounded-2xl border px-1 text-xs leading-tight', draft.formality === f ? 'border-white bg-white text-black' : 'border-line bg-surface-2 text-muted')}>
                  <span className="block text-base font-semibold">{f}</span>{FORMALITY_LABELS[f]}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((w) => (
                <button key={w} type="button" aria-pressed={draft.warmth === w} onClick={() => onChange({ ...draft, warmth: w, formalityManual: true })}
                  className={cn('min-h-11 rounded-2xl border text-sm', draft.warmth === w ? 'border-white bg-white text-black' : 'border-line bg-surface-2 text-muted')}>
                  {WARMTH_LABELS[w]}
                </button>
              ))}
            </div>
            {draft.formalityManual && (
              <button type="button" className="mt-2 min-h-11 text-sm text-muted underline" onClick={() => onChange(recompute({ ...draft, formalityManual: false }))}>Use automatic values</button>
            )}
          </Section>
        </Reveal>
      )}

      <Reveal i={k++} on={reveal}>
        <Section title="How many identical ones">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer" onClick={() => onChange({ ...draft, quantity: Math.max(1, draft.quantity - 1) })} className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2"><Minus size={18} /></button>
            <span className="w-10 text-center text-xl font-semibold tabular-nums" aria-live="polite">{draft.quantity}</span>
            <button type="button" aria-label="More" onClick={() => onChange({ ...draft, quantity: Math.min(20, draft.quantity + 1) })} className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2"><Plus size={18} /></button>
          </div>
        </Section>
      </Reveal>

      {draft.type && (
        <Reveal i={k++} on={reveal}>
          <Section title="Occasions">
            <p className="mb-2 text-sm text-muted">Worked out from the tags. Tap to always allow or never use it for an occasion.</p>
            <div className="flex flex-wrap gap-2">
              {occasions.map((o) => {
                const ov = draft.overrides[o.id];
                const fits = checkItem(asItem, o).ok;
                const next = ov === undefined ? (fits ? 'never' : 'allow') : ov === 'allow' ? 'never' : undefined;
                return (
                  <Chip key={o.id} selected={ov === 'allow' || (ov === undefined && fits)} className={ov === 'never' ? 'border-danger/40 text-danger' : ''}
                    onClick={() => {
                      const overrides = { ...draft.overrides };
                      if (next) overrides[o.id] = next; else delete overrides[o.id];
                      onChange({ ...draft, overrides });
                    }}>
                    {ov === 'never' ? <Ban size={14} /> : (ov === 'allow' || fits) ? <Check size={14} /> : null}
                    {o.short}
                    {ov && <span className="text-[10px] uppercase tracking-wide opacity-70">{ov === 'allow' ? 'always' : 'never'}</span>}
                  </Chip>
                );
              })}
            </div>
          </Section>
        </Reveal>
      )}
    </div>
  );
}
