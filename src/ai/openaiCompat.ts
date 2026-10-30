import { errorFromResponse, AiError } from './errors';
import { parseJsonText, validate, withTimeout } from './json';
import type { AiProvider, JsonCall } from './provider';
import { jsonSchemaOf } from './schemas';

export const PRESETS = {
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
} as const;

/** Any OpenAI-compatible chat completions API (Groq, OpenRouter). JSON mode, schema in the prompt. */
export class OpenAiCompatProvider implements AiProvider {
  label: string;
  constructor(
    public id: 'groq' | 'openrouter',
    private apiKey: string,
    private model: string,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {
    this.label = PRESETS[id].label;
  }

  async json<T>(call: JsonCall<T>): Promise<T> {
    if (!this.model) throw new AiError('unavailable', 'No model set');
    const schema = JSON.stringify(jsonSchemaOf(call.responseSchema ?? call.schema));
    const content: unknown[] = [{ type: 'text', text: call.prompt }];
    if (call.image) content.push({ type: 'image_url', image_url: { url: `data:${call.image.mime};base64,${call.image.base64}` } });
    const text = await withTimeout(call.timeoutMs, async (signal) => {
      const res = await this.fetchImpl(`${PRESETS[this.id].baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(this.id === 'openrouter' ? { 'X-Title': 'Wardrobe Stylist' } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${call.system}\nReply with a single JSON object matching this JSON Schema:\n${schema}` },
            { role: 'user', content },
          ],
        }),
      });
      const body = await res.text();
      if (!res.ok) throw errorFromResponse(res, body);
      const msg = JSON.parse(body)?.choices?.[0]?.message?.content;
      if (typeof msg !== 'string' || !msg) throw new AiError('invalid', 'Empty reply');
      return msg;
    });
    return validate(call.schema, parseJsonText(text));
  }
}
