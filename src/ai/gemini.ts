import { errorFromResponse, AiError } from './errors';
import { parseJsonText, validate, withTimeout } from './json';
import type { AiProvider, JsonCall } from './provider';
import { jsonSchemaOf } from './schemas';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Collects the model's answer text from any reply shape (Interactions steps/outputs or generateContent parts),
 * skipping thought summaries.
 */
export function replyTexts(json: unknown): string[] {
  const texts: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, unknown>;
    if (n.type === 'thought' || n.thought === true) return;
    if (typeof n.output_text === 'string') texts.push(n.output_text);
    if (typeof n.text === 'string' && (n.type === undefined || n.type === 'text')) texts.push(n.text);
    for (const [k, v] of Object.entries(n)) if (k !== 'summary' && k !== 'usage' && v && typeof v === 'object') visit(v);
  };
  visit(json);
  return texts;
}

/** Kept for older callers and tests. */
export const interactionText = (json: unknown) => replyTexts(json).pop() ?? null;
export const generateContentText = (json: unknown) => replyTexts(json).join('') || null;

/** First reply text that parses as JSON and matches the schema (the answer is usually the last text). */
export function pickJson<T>(texts: string[], call: JsonCall<T>): T {
  let last: unknown = new AiError('invalid', 'Empty reply', undefined, 'The reply had no text');
  for (const t of [...texts].reverse()) {
    try {
      return validate(call.schema, parseJsonText(t));
    } catch (e) {
      last = e;
    }
  }
  if (texts.length && texts.join('').trim().length < 2) last = new AiError('invalid', 'Empty reply', undefined, 'The reply was empty');
  throw last;
}

type Strategy = 'interactions-schema' | 'interactions-plain' | 'generate-schema' | 'generate-plain';
const ORDER: Strategy[] = ['interactions-schema', 'interactions-plain', 'generate-schema', 'generate-plain'];
/** Which request style worked last for a model, so later calls go straight to it. */
const working = new Map<string, number>();

/**
 * Gemini. Tries the Interactions API with a JSON schema first, then simpler request styles
 * (schema in the prompt, then the generateContent API) when a style is rejected or its reply can't be read.
 */
export class GeminiProvider implements AiProvider {
  id = 'gemini' as const;
  label = 'Gemini';

  constructor(private apiKey: string, private model: string, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  async json<T>(call: JsonCall<T>): Promise<T> {
    const schema = jsonSchemaOf(call.responseSchema ?? call.schema);
    const start = working.get(this.model) ?? 0;
    const notes: string[] = [];
    let last: unknown;
    for (let i = start; i < ORDER.length; i++) {
      try {
        const texts = await withTimeout(call.timeoutMs, (signal) => this.send(ORDER[i], call, schema, signal));
        const value = pickJson(texts, call);
        working.set(this.model, i);
        return value;
      } catch (e) {
        last = e;
        if (!(e instanceof AiError) || !['invalid', 'unavailable'].includes(e.kind)) throw e;
        notes.push(`${ORDER[i].startsWith('interactions') ? 'Interactions' : 'generateContent'}: ${e.detail ?? e.message}`);
        if (e.kind === 'unavailable') {
          // 404: the endpoint (or the model) doesn't exist. Skip the other style of the same endpoint.
          if (!ORDER[i].startsWith('interactions')) break;
          i = ORDER.indexOf('generate-schema') - 1;
        }
      }
    }
    working.delete(this.model);
    if (last instanceof AiError) last.detail = [...new Set(notes)].join(' | ');
    throw last;
  }

  private headers() {
    return { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey };
  }

  private async post(url: string, body: unknown, signal: AbortSignal): Promise<string[]> {
    const res = await this.fetchImpl(url, { method: 'POST', headers: this.headers(), signal, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw errorFromResponse(res, text);
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new AiError('invalid', 'Reply was not JSON', undefined, text.slice(0, 160)); }
    const texts = replyTexts(json);
    if (!texts.length) {
      const reason = (json as any)?.candidates?.[0]?.finishReason ?? (json as any)?.promptFeedback?.blockReason ?? (json as any)?.status;
      throw new AiError('invalid', 'Empty reply', undefined, `No text in the reply${reason ? ` (${reason})` : ''}`);
    }
    return texts;
  }

  private send<T>(s: Strategy, call: JsonCall<T>, schema: Record<string, unknown>, signal: AbortSignal): Promise<string[]> {
    const withSchema = s.endsWith('schema');
    const system = withSchema ? call.system : `${call.system}\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(schema)}`;
    if (s.startsWith('interactions')) {
      const input: unknown[] = [{ type: 'text', text: call.prompt }];
      if (call.image) input.push({ type: 'image', data: call.image.base64, mime_type: call.image.mime });
      return this.post(`${BASE}/interactions`, {
        model: this.model,
        input,
        system_instruction: system,
        response_format: withSchema ? { type: 'text', mime_type: 'application/json', schema } : { type: 'text', mime_type: 'application/json' },
        store: false,
      }, signal);
    }
    const parts: unknown[] = [{ text: call.prompt }];
    if (call.image) parts.push({ inline_data: { mime_type: call.image.mime, data: call.image.base64 } });
    return this.post(`${BASE}/models/${encodeURIComponent(this.model)}:generateContent`, {
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: withSchema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : { responseMimeType: 'application/json' },
    }, signal);
  }
}
