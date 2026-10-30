import { AnimatePresence, motion } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows "new version available" when an updated app has been downloaded. */
export function UpdatePrompt() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW();
  return (
    <AnimatePresence>
      {need && (
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="fixed inset-x-0 top-0 z-[65] mx-auto max-w-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-line-strong bg-surface-3 px-4 text-sm">
            <span className="flex-1">New version available</span>
            <button type="button" className="min-h-11 px-2 text-muted" onClick={() => setNeed(false)}>Later</button>
            <button type="button" className="min-h-11 px-2 font-semibold" onClick={() => updateServiceWorker(true)}>Reload</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
