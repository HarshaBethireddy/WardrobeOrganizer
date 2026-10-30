import { Briefcase, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Coffee, Dumbbell, House, PartyPopper, Plane, Snowflake, Sparkles, Sun, Wine } from 'lucide-react';
import type { OccasionProfile } from '@/domain/occasions';
import { weatherKind } from '@/weather/weather';

const OCC = { briefcase: Briefcase, coffee: Coffee, wine: Wine, party: PartyPopper, sparkles: Sparkles, dumbbell: Dumbbell, plane: Plane, house: House };

export function OccasionIcon({ occasion, size = 18 }: { occasion: Pick<OccasionProfile, 'icon'>; size?: number }) {
  const I = OCC[occasion.icon] ?? Coffee;
  return <I size={size} strokeWidth={1.7} />;
}

const WX = { clear: Sun, partly: CloudSun, cloudy: Cloud, fog: CloudFog, rain: CloudRain, snow: Snowflake, storm: CloudLightning };

export function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
  const I = WX[weatherKind(code)];
  return <I size={size} strokeWidth={1.7} />;
}
