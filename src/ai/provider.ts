import type { z } from 'zod';

export interface ImageInput { base64: string; mime: string }

export interface JsonCall<T> {
  system: string;
  prompt: string;
  image?: ImageInput;
  schema: z.ZodType<T>;
  /** Strict schema used as the response format (defaults to `schema`). */
  responseSchema?: z.ZodType;
  timeoutMs: number;
}

/** A provider answers a prompt (optionally with a photo) with JSON matching a schema. */
export interface AiProvider {
  id: 'gemini' | 'groq' | 'openrouter' | 'on-device';
  label: string;
  json<T>(call: JsonCall<T>): Promise<T>;
}
