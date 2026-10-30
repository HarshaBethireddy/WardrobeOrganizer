import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Card, Section, Switch } from '@/components/ui';
import { useSetting } from '@/data/settings';
import { ATTRIBUTION } from '@/weather/weather';
import { AiSettings } from './AiSettings';
import { BackupSettings } from './BackupSettings';
import { SuggestionSettings } from './SuggestionSettings';
import { WeatherSettings } from './WeatherSettings';

export function SettingsScreen() {
  const { hash } = useLocation();
  const [reduce, setReduce] = useSetting('ui.reduceMotion');
  const [haptics, setHaptics] = useSetting('ui.haptics');
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    return () => clearTimeout(t);
  }, [hash]);
  return (
    <div className="px-4 pt-safe pb-8">
      <header className="pt-6 pb-1"><h1 className="text-3xl font-semibold tracking-tight">Settings</h1></header>
      <AiSettings />
      <WeatherSettings />
      <SuggestionSettings />
      <BackupSettings />
      <Section title="Feel">
        <Card>
          <Switch label="Reduce motion" description="Also follows your phone's remove-animations setting" checked={reduce} onChange={setReduce} />
          <Switch label="Haptics" description="A short tick on Wear, Reject, Like and Save" checked={haptics} onChange={setHaptics} />
        </Card>
      </Section>
      <Section title="About">
        <Card>
          <p className="text-sm text-muted">Wardrobe Stylist {__APP_VERSION__}. Your data stays on this phone. Free to run: free hosting, free AI tiers, no account.</p>
          <p className="mt-2 text-xs text-faint">{ATTRIBUTION}. On-device AI: Marqo FashionSigLIP. Typeface: Inter (SIL Open Font License). Icons: Lucide.</p>
        </Card>
      </Section>
    </div>
  );
}
