import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { createStore, useStore } from '@/lib/store';
import { uid } from '@/lib/id';

export interface Toast { id: string; text: string; action?: { label: string; run: () => void }; tone?: 'neutral' | 'danger' }

const toasts = createStore<Toast[]>([]);

export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> & { ms?: number } = {}) {
  const t: Toast = { id: uid('t'), text, action: opts.action, tone: opts.tone };
  toasts.set((l) => [...l.slice(-2), t]);
  setTimeout(() => dismiss(t.id), opts.ms ?? (opts.action ? 5000 : 2600));
}

export const dismiss = (id: string) => toasts.set((l) => l.filter((t) => t.id !== id));

export function Toaster() {
  const list = useStore(toasts);
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface-3 px-4 text-sm shadow-2xl shadow-black"
          >
            <span className={t.tone === 'danger' ? 'flex-1 text-danger' : 'flex-1'}>{t.text}</span>
            {t.action && (
              <button type="button" className="min-h-11 px-2 font-semibold" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
