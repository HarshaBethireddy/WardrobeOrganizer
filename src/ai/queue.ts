import { AiError } from './errors';

export interface QueueOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs AI requests one at a time and backs off on rate-limit (429) errors. */
export class RequestQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private opts: QueueOptions;
  constructor(opts: Partial<QueueOptions> = {}) {
    this.opts = { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 20000, sleep: defaultSleep, ...opts };
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => this.attempt(fn), () => this.attempt(fn));
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async attempt<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        const limited = e instanceof AiError && e.kind === 'rate-limit';
        if (!limited || i >= this.opts.maxRetries) throw e;
        const wait = Math.min(this.opts.maxDelayMs, (e as AiError).retryAfterMs ?? this.opts.baseDelayMs * 2 ** i);
        await this.opts.sleep(wait);
      }
    }
  }
}

export const aiQueue = new RequestQueue();
