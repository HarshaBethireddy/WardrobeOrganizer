import type { z } from 'zod';
import { AiError } from './errors';

/** Pulls a JSON object out of model text (strips code fences and <think> blocks). */
export function parseJsonText(text: string): unknown {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    throw new AiError('invalid', 'Reply was not JSON');
  }
}

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new AiError('invalid', 'Reply did not match the expected shape');
  return r.data;
}

export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AiError('timeout', 'Timed out');
    if (e instanceof TypeError) throw new AiError('network', 'Network error');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
