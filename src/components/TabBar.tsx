import { motion } from 'motion/react';
import { CalendarDays, MessageCircle, Settings, Shirt, WandSparkles } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { logPulse } from './fly';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/cn';

export const TABS = [
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt, match: ['/wardrobe'] },
  { id: 'ask', label: 'Ask', icon: MessageCircle, match: ['/ask', '/suggest'] },
  { id: 'check', label: 'Check', icon: WandSparkles, match: ['/check'] },
  { id: 'log', label: 'Log', icon: CalendarDays, match: ['/log'] },
  { id: 'settings', label: 'Settings', icon: Settings, match: ['/settings'] },
] as const;

export function TabBar() {
  const { pathname } = useLocation();
  const pulse = useStore(logPulse);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-line bg-black/85 backdrop-blur-xl pb-safe">
      <ul className="flex">
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname.startsWith(m));
          const Icon = t.icon;
          return (
            <li key={t.id} className="flex-1">
              <NavLink to={`/${t.id}`} data-tab={t.id} aria-current={active ? 'page' : undefined} className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]">
                {active && <motion.span layoutId="tab-pill" className="absolute top-2 h-8 w-14 rounded-full bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <motion.span key={t.id === 'log' ? pulse : 0} initial={t.id === 'log' && pulse ? { scale: 1.35 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }} className="relative">
                  <Icon size={22} strokeWidth={active ? 2.1 : 1.6} className={active ? 'text-white' : 'text-faint'} />
                </motion.span>
                <span className={cn('relative', active ? 'text-white' : 'text-faint')}>{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
