import { db as defaultDb, type WardrobeDB } from '@/data/db';
import { countAiRequest, getSecret, getSetting, type ProviderId } from '@/data/settings';
import { todayStr } from '@/lib/dates';
import { AiError, isTransient } from './errors';
import { GeminiProvider } from './gemini';
import { OpenAiCompatProvider } from './openaiCompat';
import type { AiProvider, ImageInput, JsonCall } from './provider';
import { aiQueue, type RequestQueue } from './queue';
import { LooseTagSchema, PingSchema, TagSchema } from './schemas';
import { TAG_SYSTEM, tagPrompt } from './prompts';
import { draftFromTag, type ItemDraft } from './normalize';

export async function makeProvider(id: ProviderId, db: WardrobeDB = defaultDb, fetchImpl?: typeof fetch): Promise<AiProvider | null> {
  if (id === 'gemini') {
    const key = await getSecret('secret:gemini', db);
    return key ? new GeminiProvider(key, await getSetting('ai.geminiModel', db), fetchImpl) : null;
  }
  if (id === 'groq' || id === 'openrouter') {
    const key = await getSecret(id === 'groq' ? 'secret:groq' : 'secret:openrouter', db);
    const model = await getSetting(id === 'groq' ? 'ai.groqModel' : 'ai.openrouterModel', db);
    return key && model ? new OpenAiCompatProvider(id, key, model, fetchImpl) : null;
  }
  return null;
}

/** Main provider, then the fallback provider, skipping any without a key. */
export async function providerChain(db: WardrobeDB = defaultDb, fetchImpl?: typeof fetch): Promise<AiProvider[]> {
  const ids = [await getSetting('ai.primary', db), await getSetting('ai.fallback', db)];
  const out: AiProvider[] = [];
  for (const id of [...new Set(ids)]) {
    const p = await makeProvider(id, db, fetchImpl);
    if (p) out.push(p);
  }
  return out;
}

export async function aiConfigured(db: WardrobeDB = defaultDb): Promise<boolean> {
  return (await providerChain(db)).length > 0;
}

export interface RunOptions { db?: WardrobeDB; queue?: RequestQueue; chain?: AiProvider[] }

/**
 * Runs one JSON call: on rate limits, server errors or timeouts it tries the fallback provider.
 * An unusable reply is retried once with the same provider.
 */
export async function runJson<T>(call: JsonCall<T>, opts: RunOptions = {}): Promise<{ value: T; provider: string }> {
  const db = opts.db ?? defaultDb;
  const chain = opts.chain ?? (await providerChain(db));
  if (!chain.length) throw new AiError('unavailable', 'No AI provider configured');
  const queue = opts.queue ?? aiQueue;
  let last: unknown = null;
  for (const p of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await countAiRequest(todayStr(), db).catch(() => undefined);
        const value = await queue.run(() => p.json(call));
        return { value, provider: p.label };
      } catch (e) {
        last = e;
        if (e instanceof AiError && e.kind === 'invalid' && attempt === 0) continue;
        break;
      }
    }
    if (!isTransient(last)) throw last;
  }
  throw last;
}

/** Tags a clothing photo. Pixel colors fill in when the AI gives no shade. */
export async function tagWithAi(image: ImageInput, pixel: { primary?: string; secondary?: string }, opts: RunOptions = {}): Promise<ItemDraft & { provider: string }> {
  const { value, provider } = await runJson(
    { system: TAG_SYSTEM, prompt: tagPrompt(), image, schema: LooseTagSchema, responseSchema: TagSchema, timeoutMs: 30000 },
    opts,
  );
  if (value.isClothing === false) throw new AiError('not-clothing', 'Not clothing');
  if (value.itemCount > 1) throw new AiError('multiple-items', 'Several items');
  return { ...draftFromTag(value, pixel, 'ai'), provider };
}

export async function testConnection(id: ProviderId, db: WardrobeDB = defaultDb): Promise<{ ok: boolean; message: string }> {
  const p = await makeProvider(id, db);
  if (!p) return { ok: false, message: 'Add a key (and a model) first.' };
  try {
    await p.json({ system: 'Reply with JSON.', prompt: 'Return {"ok": true}.', schema: PingSchema, timeoutMs: 15000 });
    return { ok: true, message: `${p.label} is working.` };
  } catch (e) {
    if (e instanceof AiError) {
      if (e.kind === 'network') return { ok: false, message: 'Could not reach the provider. Check your connection; the browser may also be blocked from calling it (CORS).' };
      if (e.kind === 'auth') return { ok: false, message: 'The key was rejected.' };
      if (e.kind === 'rate-limit') return { ok: true, message: 'Key works, but the free limit is used up for now.' };
      if (e.kind === 'unavailable') return { ok: false, message: 'Model not found. Check the model ID.' };
    }
    return { ok: false, message: 'The provider answered, but not with usable JSON. Try another model.' };
  }
}
