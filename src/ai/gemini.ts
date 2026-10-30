import { errorFromResponse, AiError } from './errors';
import { parseJsonText, validate, withTimeout } from './json';
import type { AiProvider, JsonCall } from './provider';
import { jsonSchemaOf } from './schemas';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Collects text from an Interactions API reply (output_text, or text parts inside outputs/steps). */
export function interactionText(json: any): string | null {
  if (typeof json?.output_text === 'string') return json.output_text;
  const texts: string[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'text' && typeof node.text === 'string') texts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  for (const key of ['outputs', 'steps', 'output']) if (Array.isArray(json?.[key])) visit(json[key]);
  return texts.length ? texts[texts.length - 1] : null;
}

export function generateContentText(json: any): string | null {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const t = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
  return t || null;
}

/** Gemini via the Interactions API (store=false), falling back to generateContent if needed. */
export class GeminiProvider implements AiProvider {
  id = 'gemini' as const;
  label = 'Gemini';
  private mode: 'interactions' | 'generate' = 'interactions';

  constructor(private apiKey: string, private model: string, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  async json<T>(call: JsonCall<T>): Promise<T> {
    const schema = jsonSchemaOf(call.responseSchema ?? call.schema);
    const text = await withTimeout(call.timeoutMs, (signal) => this.send(call, schema, signal));
    return validate(call.schema, parseJsonText(text));
  }

  private async send<T>(call: JsonCall<T>, schema: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    if (this.mode === 'interactions') {
      try {
        return await this.interactions(call, schema, signal);
      } catch (e) {
        if (!(e instanceof AiError) || !['unavailable', 'invalid'].includes(e.kind)) throw e;
        this.mode = 'generate';
      }
    }
    return this.generate(call, schema, signal);
  }

  private headers() {
    return { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey };
  }

  private async interactions<T>(call: JsonCall<T>, schema: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const input: unknown[] = [{ type: 'text', text: call.prompt }];
    if (call.image) input.push({ type: 'image', data: call.image.base64, mime_type: call.image.mime });
    const res = await this.fetchImpl(`${BASE}/interactions`, {
      method: 'POST',
      headers: this.headers(),
      signal,
      body: JSON.stringify({
        model: this.model,
        input,
        system_instruction: call.system,
        response_format: { type: 'text', mime_type: 'application/json', schema },
        store: false,
      }),
    });
    const body = await res.text();
    if (!res.ok) throw errorFromResponse(res, body);
    const text = interactionText(JSON.parse(body));
    if (!text) throw new AiError('invalid', 'Empty reply');
    return text;
  }

  private async generate<T>(call: JsonCall<T>, schema: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const parts: unknown[] = [{ text: call.prompt }];
    if (call.image) parts.push({ inline_data: { mime_type: call.image.mime, data: call.image.base64 } });
    const res = await this.fetchImpl(`${BASE}/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: this.headers(),
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        systemInstruction: { parts: [{ text: call.system }] },
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 },
      }),
    });
    const body = await res.text();
    if (!res.ok) throw errorFromResponse(res, body);
    const text = generateContentText(JSON.parse(body));
    if (!text) throw new AiError('invalid', 'Empty reply');
    return text;
  }
}
