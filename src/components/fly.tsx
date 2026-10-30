import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { createStore, useStore } from '@/lib/store';
import { uid } from '@/lib/id';

interface Flight { id: string; from: DOMRect; to: DOMRect; img?: string }
const flights = createStore<Flight[]>([]);
export const logPulse = createStore(0);

/** "Wear this": a check mark, then the outfit shrinks toward the Log tab. */
export function flyToLog(from: DOMRect | undefined, img?: string) {
  const target = document.querySelector('[data-tab="log"]')?.getBoundingClientRect();
  if (!from || !target) { logPulse.set((n) => n + 1); return; }
  const f: Flight = { id: uid('f'), from, to: target, img };
  flights.set((l) => [...l, f]);
  setTimeout(() => { flights.set((l) => l.filter((x) => x.id !== f.id)); logPulse.set((n) => n + 1); }, 900);
}

export function FlightLayer() {
  const list = useStore(flights);
  return createPortal(
    <AnimatePresence>
      {list.map((f) => {
        const size = Math.min(f.from.width, 220);
        const x0 = f.from.left + f.from.width / 2 - size / 2, y0 = f.from.top + f.from.height / 2 - size / 2;
        const x1 = f.to.left + f.to.width / 2 - size / 2, y1 = f.to.top + f.to.height / 2 - size / 2;
        return (
          <motion.div
            key={f.id}
            className="pointer-events-none fixed top-0 left-0 z-[70] overflow-hidden rounded-3xl border border-line-strong bg-surface-3"
            style={{ width: size, height: size }}
            initial={{ x: x0, y: y0, scale: 1, opacity: 1 }}
            animate={{ x: [x0, x0, x1], y: [y0, y0, y1], scale: [1, 1, 0.12], opacity: [1, 1, 0.2] }}
            transition={{ duration: 0.85, times: [0, 0.4, 1], ease: [0.5, 0, 0.2, 1] }}
          >
            {f.img && <img src={f.img} alt="" className="size-full object-cover opacity-60" />}
            <motion.div className="absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
              <span className="grid size-16 place-items-center rounded-full bg-white text-black"><Check size={34} strokeWidth={2.6} /></span>
            </motion.div>
          </motion.div>
        );
      })}
    </AnimatePresence>,
    document.body,
  );
}
