import { REVIEW_TTL, mergeReview, reviewCacheKey, reviewOutfits } from '@/ai/stylist';
import type { RunOptions } from '@/ai/service';
import type { ReviewReply } from '@/ai/schemas';
import { repo as defaultRepo, type Repo } from '@/data/repo';
import type { OccasionProfile } from '@/domain/occasions';
import type { Item } from '@/domain/types';
import type { ScoredOutfit, WeatherDay } from '@/engine/types';

/** Stylist review with a 24-hour cache. Returns null when the AI is unavailable, so the rules order stays. */
export async function reviewWithCache(
  outfits: ScoredOutfit[], occ: OccasionProfile, weather: WeatherDay | null, byId: Map<string, Item>,
  opts: RunOptions & { repo?: Repo; review?: typeof reviewOutfits } = {},
): Promise<ScoredOutfit[] | null> {
  if (!outfits.length) return null;
  const repo = opts.repo ?? defaultRepo;
  const key = reviewCacheKey(outfits, occ, weather);
  const cached = await repo.getCache<ReviewReply>(key);
  if (cached) return mergeReview(outfits, cached, new Map());
  try {
    const reviewed = await (opts.review ?? reviewOutfits)(outfits, occ, weather, byId, opts);
    const reply: ReviewReply = { order: reviewed.filter((o) => o.aiReason || o.aiConcern).map((o) => ({ id: o.id, reason: o.aiReason ?? '', concern: o.aiConcern ?? '' })) };
    if (reply.order.length) await repo.setCache(key, reply, REVIEW_TTL);
    return reviewed;
  } catch {
    return null;
  }
}
