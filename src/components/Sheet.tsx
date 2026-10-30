import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/** Bottom sheet: slides up with a spring, drag the handle down (or tap outside) to close. */
export function Sheet({ open, onClose, title, children, footer, className, full }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; className?: string; full?: boolean;
}) {
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); prev?.focus?.(); };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn('absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col rounded-t-[28px] border-t border-line-strong bg-surface outline-none', full ? 'h-[92dvh]' : 'max-h-[88dvh]', className)}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
          >
            <div className="shrink-0 cursor-grab touch-none px-5 pt-2 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/25" />
              {title && (
                <div className="flex min-h-11 items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 grid size-11 place-items-center rounded-full text-muted">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
            {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
