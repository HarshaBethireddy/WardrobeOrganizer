import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { testConnection } from '@/ai/service';
import { Button, Card } from '@/components/ui';
import { maskKey, useSecret, useSetting, type ProviderId, type SecretKey } from '@/data/settings';

const field = 'min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 outline-none focus:border-white/40';

export const PROVIDER_INFO: Record<Exclude<ProviderId, 'none'>, { label: string; secret: SecretKey; model: 'ai.geminiModel' | 'ai.groqModel' | 'ai.openrouterModel'; keyUrl: string; hint: string }> = {
  gemini: { label: 'Gemini', secret: 'secret:gemini', model: 'ai.geminiModel', keyUrl: 'https://aistudio.google.com/apikey', hint: 'Free key from Google AI Studio. Create it in a project without billing, so no charges are possible.' },
  groq: { label: 'Groq', secret: 'secret:groq', model: 'ai.groqModel', keyUrl: 'https://console.groq.com/keys', hint: 'Free tier. Default vision model: qwen/qwen3.8-27b.' },
  openrouter: { label: 'OpenRouter', secret: 'secret:openrouter', model: 'ai.openrouterModel', keyUrl: 'https://openrouter.ai/keys', hint: 'Pick a free vision model (its ID ends in :free) from openrouter.ai/models.' },
};

export function ProviderCard({ id }: { id: Exclude<ProviderId, 'none'> }) {
  const info = PROVIDER_INFO[id];
  const [key, setKey] = useSecret(info.secret);
  const [model, setModel] = useSetting(info.model);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  return (
    <Card className="mt-2">
      <div className="flex items-center gap-2 font-medium"><KeyRound size={16} />{info.label}</div>
      <p className="mt-1 text-sm text-muted">{info.hint} <a className="underline" href={info.keyUrl} target="_blank" rel="noreferrer">Get a key</a></p>
      {editing || !key ? (
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`${info.label} API key`} aria-label={`${info.label} API key`} className={`${field} pr-12`} />
            <button type="button" aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)} className="absolute top-0 right-0 grid size-12 place-items-center text-muted">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <Button variant="primary" disabled={!draft.trim()} onClick={async () => { await setKey(draft); setDraft(''); setEditing(false); setStatus(null); }}>Save</Button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl bg-surface-2 px-3 py-3 text-sm">{maskKey(key)}</code>
          <Button size="sm" onClick={() => setEditing(true)}>Change</Button>
          <Button size="sm" onClick={async () => { await setKey(''); setStatus(null); }}>Remove</Button>
        </div>
      )}
      <label className="mt-3 block text-sm text-muted">Model ID
        <input value={model} onChange={(e) => setModel(e.target.value.trim())} spellCheck={false} aria-label={`${info.label} model ID`} className={`${field} mt-1 text-fg`} placeholder={id === 'openrouter' ? 'provider/model:free' : ''} />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" disabled={!key || testing} onClick={async () => { setTesting(true); setStatus(await testConnection(id)); setTesting(false); }}>{testing ? 'Testing\u2026' : 'Test connection'}</Button>
        {status && <span className={`text-sm ${status.ok ? 'text-fg' : 'text-danger'}`}>{status.message}</span>}
      </div>
    </Card>
  );
}
