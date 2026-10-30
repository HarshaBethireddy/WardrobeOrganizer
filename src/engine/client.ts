import { wrap, type Remote } from 'comlink';
import { evaluate, generate } from './generator';
import type { EngineInput, Evaluation, GenerateResult } from './types';
import type { OutfitSlots } from '@/domain/types';

interface EngineApi {
  generate(input: EngineInput): GenerateResult | Promise<GenerateResult>;
  evaluate(input: EngineInput, slots: OutfitSlots): Evaluation | Promise<Evaluation>;
}

let remote: Remote<EngineApi> | null = null;

/** The outfit engine runs in a Web Worker so the screen stays smooth; falls back to the main thread. */
export function engine(): { generate(i: EngineInput): Promise<GenerateResult>; evaluate(i: EngineInput, s: OutfitSlots): Promise<Evaluation> } {
  if (typeof Worker === 'undefined' || import.meta.env.MODE === 'test') {
    return { generate: async (i) => generate(i), evaluate: async (i, s) => evaluate(i, s) };
  }
  if (!remote) {
    try {
      remote = wrap<EngineApi>(new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
    } catch {
      return { generate: async (i) => generate(i), evaluate: async (i, s) => evaluate(i, s) };
    }
  }
  const r = remote;
  return { generate: (i) => r.generate(i) as Promise<GenerateResult>, evaluate: (i, s) => r.evaluate(i, s) as Promise<Evaluation> };
}
