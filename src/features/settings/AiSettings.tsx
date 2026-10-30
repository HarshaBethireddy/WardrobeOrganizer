import { Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { downloadOnDevice, removeOnDevice } from '@/ai/ondevice/client';
import { Button, Card, Chip, Section, Switch } from '@/components/ui';
import { useSetting, type ProviderId } from '@/data/settings';
import { todayStr } from '@/lib/dates';
import { ProviderCard } from './ProviderCard';

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'gemini', label: 'Gemini' }, { id: 'groq', label: 'Groq' }, { id: 'openrouter', label: 'OpenRouter' }, { id: 'none', label: 'None' },
];

export function AiSettings() {
  const [primary, setPrimary] = useSetting('ai.primary');
  const [fallback, setFallback] = useSetting('ai.fallback');
  const [review, setReview] = useSetting('ai.review');
  const [requests] = useSetting('ai.requests');
  const [ready] = useSetting('ondevice.ready');
  const [progress, setProgress] = useState<number | null>(null);
  const [odStatus, setOdStatus] = useState('');
  const shown = [...new Set([primary, fallback].filter((p): p is Exclude<ProviderId, 'none'> => p !== 'none'))];
  const download = async () => {
    setProgress(0); setOdStatus('');
    try { setOdStatus(`Ready: runs on ${await downloadOnDevice((f) => setProgress(f))}.`); }
    catch (e) { setOdStatus((e as Error).message || 'Download failed. Try again on Wi-Fi.'); }
    finally { setProgress(null); }
  };
  return (
    <Section title="AI">
      <Card>
        <p className="text-sm text-muted">AI reads each photo once and understands what you type. Outfits, counts, the log and rejections work without it.</p>
        <div className="mt-3 text-sm">Main provider</div>
        <div className="mt-1 flex flex-wrap gap-2">{PROVIDERS.map((p) => <Chip key={p.id} selected={primary === p.id} onClick={() => setPrimary(p.id)}>{p.label}</Chip>)}</div>
        <div className="mt-3 text-sm">Fallback when the main one is limited or down</div>
        <div className="mt-1 flex flex-wrap gap-2">{PROVIDERS.filter((p) => p.id !== primary || p.id === 'none').map((p) => <Chip key={p.id} selected={fallback === p.id} onClick={() => setFallback(p.id)}>{p.label}</Chip>)}</div>
        <p className="mt-3 text-xs text-faint">Free tiers may use what you send (clothing photos and text) to improve their products. Selfies never leave this phone. Keys stay on this phone and are left out of backups.</p>
        <p className="mt-1 text-xs text-faint">AI requests today: {requests.date === todayStr() ? requests.count : 0}</p>
      </Card>
      {shown.map((id) => <ProviderCard key={id} id={id} />)}
      <Card className="mt-2">
        <Switch label="Stylist reviews suggestions" description="Reorders the best outfits and adds a one-line reason. Uses one AI request per search." checked={review} onChange={setReview} />
      </Card>
      <Card className="mt-2">
        <div className="flex items-center gap-2 font-medium"><Cpu size={16} />On-device AI</div>
        <p className="mt-1 text-sm text-muted">Tags photos offline with FashionSigLIP when no cloud AI is available. One-time download: about 54 MB on phones with GPU support, 94 MB otherwise.</p>
        {progress !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full bg-white" animate={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={ready ? 'secondary' : 'primary'} disabled={progress !== null} onClick={download}>{ready ? 'Check / reload' : 'Download on-device AI'}</Button>
          {ready && <Button size="sm" onClick={async () => { await removeOnDevice(); setOdStatus('Removed.'); }}>Remove</Button>}
          <span className="text-sm text-muted">{progress !== null ? `${Math.round(progress * 100)}%` : odStatus || (ready ? 'Downloaded' : 'Not downloaded')}</span>
        </div>
      </Card>
    </Section>
  );
}
