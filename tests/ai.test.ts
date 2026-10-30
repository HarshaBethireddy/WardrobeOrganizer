import { describe, expect, it, vi } from 'vitest';
import { AiError } from '@/ai/errors';
import { GeminiProvider } from '@/ai/gemini';
import { OpenAiCompatProvider } from '@/ai/openaiCompat';
import { draftFromTag, closestAllowed } from '@/ai/normalize';
import { RequestQueue } from '@/ai/queue';
import { LooseTagSchema, PingSchema, TagSchema } from '@/ai/schemas';
import { runJson, tagWithAi } from '@/ai/service';
import type { AiProvider, JsonCall } from '@/ai/provider';
import { WardrobeDB } from '@/data/db';
import { findDuplicate } from '@/features/wardrobe/analyze';
import { mk } from './helpers';

const tag = (over: Record<string, unknown> = {}) => ({
  isClothing: true, itemCount: 1, type: 'jeans', name: 'Blue-green shaded jeans', primaryShade: 'teal', secondaryShade: 'none', closure: 'buttons', sleeve: 'na',
  neck: 'na', pattern: 'solid', wash: 'ombre', distress: 'none', fit: 'regular', material: 'denim', canOpen: false, formality: 2, warmth: 2, confidence: 0.9, ...over,
});
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
let models = 0;
const gemini = (...replies: Response[]) => {
  const f = vi.fn(async () => replies.shift() ?? json({}, 500));
  return { p: new GeminiProvider('key', `gemini-test-${++models}`, f as unknown as typeof fetch), f };
};
const bodyOf = (f: ReturnType<typeof vi.fn>, n: number) => JSON.parse(String((f.mock.calls[n] as unknown as [string, RequestInit])[1].body));
const urlOf = (f: ReturnType<typeof vi.fn>, n: number) => String((f.mock.calls[n] as unknown as [string])[0]);
const call = <T,>(schema: JsonCall<T>['schema']): JsonCall<T> => ({ system: 's', prompt: 'p', schema, timeoutMs: 2000 });
const fastQueue = () => new RequestQueue({ sleep: async () => undefined, baseDelayMs: 1 });
let k = 0;
const opts = (chain: AiProvider[]) => ({ chain, queue: fastQueue(), db: new WardrobeDB(`ai-${++k}-${Date.now()}`) });

describe('Gemini adapter', () => {
  it('sends the photo inline with a JSON schema and reads an Interactions reply', async () => {
    const f = vi.fn(async () => json({ status: 'completed', steps: [{ type: 'thought', summary: [{ type: 'text', text: 'thinking' }] }, { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(tag()) }] }] }));
    const p = new GeminiProvider('key', 'gemini-3.8-flash', f as unknown as typeof fetch);
    const r = await p.json({ ...call(LooseTagSchema), responseSchema: TagSchema, image: { base64: 'AAA', mime: 'image/jpeg' } });
    expect(r.wash).toBe('ombre');
    expect(urlOf(f, 0)).toContain('/v1beta/interactions');
    const body = bodyOf(f, 0);
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.store).toBe(false);
    expect(body.input[1]).toEqual({ type: 'image', data: 'AAA', mime_type: 'image/jpeg' });
    expect(body.response_format.schema.properties.type.enum).toContain('jeans');
    expect(JSON.stringify(body.response_format.schema)).not.toContain('additionalProperties');
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['x-goog-api-key']).toBe('key');
  });
  it('retries without a schema when the schema is rejected, then remembers what worked', async () => {
    const { p, f } = gemini(json({ error: { message: 'Invalid JSON payload received. Unknown name "schema"' } }, 400), json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"ok": true}' }] }] }), json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"ok": true}' }] }] }));
    expect(await p.json(call(PingSchema))).toEqual({ ok: true });
    expect(bodyOf(f, 1).response_format.schema).toBeUndefined();
    expect(bodyOf(f, 1).system_instruction).toContain('JSON Schema');
    await p.json(call(PingSchema));
    expect(f).toHaveBeenCalledTimes(3);
    expect(bodyOf(f, 2).response_format.schema).toBeUndefined();
  });
  it('falls back to generateContent when the Interactions endpoint is missing, and skips thought parts', async () => {
    const { p, f } = gemini(json('not found', 404), json({ candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: '{"ok": true}' }] } }] }));
    expect(await p.json(call(PingSchema))).toEqual({ ok: true });
    expect(urlOf(f, 1)).toContain(':generateContent');
    expect(bodyOf(f, 1).generationConfig.responseJsonSchema.properties.ok.type).toBe('boolean');
  });
  it('reports the provider error text when every request style fails', async () => {
    const bad = () => json('{"error":{"message":"Model does not support JSON"}}', 400);
    const { p, f } = gemini(bad(), bad(), bad(), bad());
    const err = await p.json(call(PingSchema)).catch((e) => e);
    expect(err).toMatchObject({ kind: 'invalid' });
    expect(err.detail).toContain('HTTP 400: Model does not support JSON');
    expect(f).toHaveBeenCalledTimes(4);
  });
  it('maps 429 and bad keys to clear errors, and an unreadable reply to invalid', async () => {
    await expect(gemini(json('{"error":{"details":[{"retryDelay":"7s"}]}}', 429)).p.json(call(PingSchema))).rejects.toMatchObject({ kind: 'rate-limit', retryAfterMs: 7000 });
    await expect(gemini(json('API key not valid', 400)).p.json(call(PingSchema))).rejects.toMatchObject({ kind: 'auth' });
    const words = () => json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'sorry, no JSON here' }] }] });
    await expect(gemini(words(), words(), words(), words()).p.json(call(PingSchema))).rejects.toMatchObject({ kind: 'invalid' });
  });
  it('still reads SDK-style output_text replies', async () => {
    expect(await gemini(json({ output_text: '{"ok": true}' })).p.json(call(PingSchema))).toEqual({ ok: true });
  });
});
describe('tagging', () => {
  it('maps unknown values, limits formality to the type default +-1 and keeps pixel colors as a fallback', () => {
    const d = draftFromTag(LooseTagSchema.parse(tag({ type: 'Jean', wash: 'shaded', closure: 'zip', formality: 5, primaryShade: 'not-a-color' })), { primary: 'denim-medium' });
    expect(d.type).toBe('jeans');
    expect(d.attrs.wash).toBe('ombre');
    expect(d.attrs.closure).toBe('zipper');
    expect(d.formality).toBeLessThanOrEqual(3);
    expect(d.primaryShade).toBe('denim-medium');
    expect(closestAllowed('stripped', ['stripes', 'solid'], 'pattern')).toBe('stripes');
  });
  it('asks to crop or retake when the photo is not one piece of clothing', async () => {
    const notClothing = gemini(json({ output_text: JSON.stringify(tag({ isClothing: false })) })).p;
    await expect(tagWithAi({ base64: 'A', mime: 'image/jpeg' }, {}, opts([notClothing]))).rejects.toMatchObject({ kind: 'not-clothing' });
    const several = gemini(json({ output_text: JSON.stringify(tag({ itemCount: 3 })) })).p;
    await expect(tagWithAi({ base64: 'A', mime: 'image/jpeg' }, {}, opts([several]))).rejects.toMatchObject({ kind: 'multiple-items' });
  });
  it('retries a malformed reply once', async () => {
    const { p, f } = gemini(json({ output_text: 'oops' }), json({ output_text: JSON.stringify(tag()) }));
    // The adapter's own second style handles the bad reply, so only two requests are made.
    const d = await tagWithAi({ base64: 'A', mime: 'image/jpeg' }, {}, opts([p]));
    expect(d.type).toBe('jeans');
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('offers to add to quantity for a duplicate', () => {
    const owned = [mk('shirt', 'black')];
    expect(findDuplicate(owned, { type: 'shirt', primaryShade: 'black', attrs: owned[0].attrs })).toBe(owned[0]);
    expect(findDuplicate(owned, { type: 'shirt', primaryShade: 'white', attrs: owned[0].attrs })).toBeUndefined();
  });
});

describe('request queue and fallback', () => {
  it('backs off on 429 and then succeeds', async () => {
    const waits: number[] = [];
    const q = new RequestQueue({ sleep: async (ms) => { waits.push(ms); }, baseDelayMs: 1000 });
    let n = 0;
    const r = await q.run(async () => { if (n++ < 2) throw new AiError('rate-limit', 'x'); return 'ok'; });
    expect(r).toBe('ok');
    expect(waits).toEqual([1000, 2000]);
  });
  it('waits with fake timers until the backoff passes', async () => {
    vi.useFakeTimers();
    const q = new RequestQueue({ baseDelayMs: 5000 });
    let n = 0;
    const p = q.run(async () => { if (n++ === 0) throw new AiError('rate-limit', 'x'); return 'done'; });
    await vi.advanceTimersByTimeAsync(4999);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toBe('done');
    vi.useRealTimers();
  });
  it('tries the fallback provider on rate limits, server errors and timeouts', async () => {
    const limited: AiProvider = { id: 'gemini', label: 'Gemini', json: async () => { throw new AiError('rate-limit', 'x'); } };
    const down: AiProvider = { id: 'gemini', label: 'Gemini', json: async () => { throw new AiError('server', 'x'); } };
    const ok: AiProvider = { id: 'groq', label: 'Groq', json: async () => ({ ok: true }) as never };
    expect((await runJson(call(PingSchema), opts([limited, ok]))).provider).toBe('Groq');
    expect((await runJson(call(PingSchema), opts([down, ok]))).provider).toBe('Groq');
  });
  it('does not try the fallback for a rejected key', async () => {
    const bad: AiProvider = { id: 'gemini', label: 'Gemini', json: async () => { throw new AiError('auth', 'x'); } };
    const ok = { id: 'groq', label: 'Groq', json: vi.fn(async () => ({ ok: true })) } as unknown as AiProvider;
    await expect(runJson(call(PingSchema), opts([bad, ok]))).rejects.toMatchObject({ kind: 'auth' });
  });
  it('fails clearly when no AI is set up', async () => {
    await expect(runJson(call(PingSchema), opts([]))).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('OpenAI-compatible adapter (Groq, OpenRouter)', () => {
  it('sends JSON mode, the schema in the prompt and the photo as a data URL', async () => {
    const f = vi.fn(async () => json({ choices: [{ message: { content: '```json\n{"ok": true}\n```' } }] }));
    const p = new OpenAiCompatProvider('groq', 'gsk_key', 'qwen/qwen3.8-27b', f as unknown as typeof fetch);
    expect(await p.json({ ...call(PingSchema), image: { base64: 'BBB', mime: 'image/jpeg' } })).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('JSON Schema');
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,BBB');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_key');
  });
  it('handles errors and thinking blocks', async () => {
    const f = vi.fn(async () => json({ choices: [{ message: { content: '<think>hmm</think>{"ok": true}' } }] }));
    expect(await new OpenAiCompatProvider('openrouter', 'k', 'x/y:free', f as unknown as typeof fetch).json(call(PingSchema))).toEqual({ ok: true });
    const g = vi.fn(async () => json('busy', 503));
    await expect(new OpenAiCompatProvider('openrouter', 'k', 'x/y:free', g as unknown as typeof fetch).json(call(PingSchema))).rejects.toMatchObject({ kind: 'server' });
    await expect(new OpenAiCompatProvider('openrouter', 'k', '', g as unknown as typeof fetch).json(call(PingSchema))).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
