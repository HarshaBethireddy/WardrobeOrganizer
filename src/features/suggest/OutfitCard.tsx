import { motion } from 'motion/react';
import { Ban, Check, Minus, Sparkles, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { OutfitCollage } from '@/components/media';
import { Button } from '@/components/ui';
import type { Item } from '@/domain/types';
import type { ScoredOutfit } from '@/engine/types';
import { cn } from '@/lib/cn';

export const PATTERN_LABELS: Record<string, string> = {
  contrast: 'Contrast', tonal: 'Tonal', monochrome: 'Monochrome', neutral: 'Neutral', 'neutral-accent': 'One accent', 'color-wheel': 'Color wheel', none: 'Mixed',
};

export function scoreWord(s: number) {
  return s >= 85 ? 'Great' : s >= 72 ? 'Good' : s >= 55 ? 'Okay' : 'Weak';
}

export function ReasonList({ outfit, max = 3 }: { outfit: Pick<ScoredOutfit, 'reasons' | 'aiReason' | 'aiConcern'>; max?: number }) {
  const rules = outfit.reasons.filter((r) => r.text).slice(0, outfit.aiReason ? Math.max(1, max - 1) : max);
  return (
    <ul className="space-y-1.5 text-sm">
      {outfit.aiReason && (
        <li className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" /><span><span className="text-faint">Stylist: </span>{outfit.aiReason}</span></li>
      )}
      {outfit.aiConcern && <li className="flex gap-2 text-warn"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{outfit.aiConcern}</li>}
      {rules.map((r) => (
        <li key={r.text} className={cn('flex gap-2', r.impact < 0 ? 'text-muted' : '')}>
          {r.impact < 0 ? <Minus size={15} className="mt-0.5 shrink-0 text-faint" /> : <Check size={15} className="mt-0.5 shrink-0" />}
          {r.text}
        </li>
      ))}
    </ul>
  );
}

export function OutfitCard({ outfit, byId, index, onWear, onReject, worn }: {
  outfit: ScoredOutfit; byId: Map<string, Item>; index: number; worn?: boolean;
  onWear: (rect: DOMRect | undefined, img?: string) => void; onReject: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22 } }}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 }, opacity: { delay: Math.min(index, 6) * 0.05 }, y: { delay: Math.min(index, 6) * 0.05 } }}
      className="rounded-[28px] border border-line bg-surface p-3"
      aria-label={`Outfit scored ${outfit.score}`}
    >
      <OutfitCollage slots={outfit.slots} byId={byId} />
      <div className="px-1 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold text-black tabular-nums">{outfit.score}</span>
          <span className="text-sm text-muted">{scoreWord(outfit.score)}{' \u00b7 '}{PATTERN_LABELS[outfit.pattern] ?? outfit.pattern}</span>
        </div>
        <ReasonList outfit={outfit} />
        {outfit.warnings?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-warn">{outfit.warnings.slice(0, 2).map((w) => <li key={w} className="flex gap-2"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{w}</li>)}</ul>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" tick disabled={worn} icon={worn ? <Check size={18} /> : undefined} onClick={() => onWear(ref.current?.getBoundingClientRect(), ref.current?.querySelector('img')?.getAttribute('src') ?? undefined)}>
            {worn ? 'In your log' : 'Wear this'}
          </Button>
          <Button aria-label="Reject" icon={<Ban size={18} />} onClick={onReject}>Reject</Button>
        </div>
      </div>
    </motion.article>
  );
}
