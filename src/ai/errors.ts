export type AiErrorKind = 'rate-limit' | 'auth' | 'server' | 'network' | 'timeout' | 'invalid' | 'unavailable' | 'not-clothing' | 'multiple-items';

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string, public retryAfterMs?: number) {
    super(message);
    this.name = 'AiError';
  }
}

/** Errors worth trying the fallback provider for. */
export const isTransient = (e: unknown) => e instanceof AiError && ['rate-limit', 'server', 'network', 'timeout', 'unavailable'].includes(e.kind);

export function userMessage(e: unknown): string {
  if (!(e instanceof AiError)) return 'Something went wrong. You can tag this item by hand.';
  switch (e.kind) {
    case 'rate-limit': return 'AI limit reached. Tag by hand or retry later.';
    case 'auth': return 'The AI key was rejected. Check it in Settings.';
    case 'network': return "You're offline. Tag by hand for now.";
    case 'timeout': return 'The AI took too long. Tag by hand or retry.';
    case 'not-clothing': return "This doesn't look like clothing. Crop to the item or retake the photo.";
    case 'multiple-items': return 'This photo shows several items. Crop to one item or retake it.';
    case 'unavailable': return 'No AI is set up. Tag by hand, or add a free key in Settings.';
    default: return 'The AI reply was unusable. Tag by hand or retry.';
  }
}

export function parseRetryAfter(res: Response, body: string): number | undefined {
  const h = res.headers.get('retry-after');
  if (h && !Number.isNaN(Number(h))) return Number(h) * 1000;
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Number(m[1]) * 1000 : undefined;
}

export function errorFromResponse(res: Response, body: string): AiError {
  const s = res.status;
  if (s === 429) return new AiError('rate-limit', 'Rate limited', parseRetryAfter(res, body));
  if (s === 401 || s === 403 || /API key not valid|API_KEY_INVALID|invalid api key/i.test(body)) return new AiError('auth', 'Invalid key');
  if (s >= 500) return new AiError('server', `Server error ${s}`);
  if (s === 404) return new AiError('unavailable', 'Model or endpoint not found');
  return new AiError('invalid', `Request failed (${s})`);
}
