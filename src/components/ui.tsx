import { animate, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { Star } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-white text-black disabled:bg-white/35',
  secondary: 'bg-surface-3 text-fg border border-line disabled:opacity-40',
  ghost: 'text-fg disabled:opacity-40',
  danger: 'bg-danger/12 text-danger border border-danger/30 disabled:opacity-40',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: ReactNode;
  tick?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, tick, className, children, onClick, type = 'button', ...rest }: ButtonProps) {
  const sizes = { sm: 'min-h-11 px-3.5 text-sm', md: 'min-h-12 px-4 text-[15px]', lg: 'min-h-14 px-5 text-base' };
  return (
    <motion.button
      type={type}
      whileTap={rest.disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onClick={(e) => {
        if (tick) haptic();
        onClick?.(e);
      }}
      className={cn('inline-flex select-none items-center justify-center gap-2 rounded-2xl font-medium', sizes[size], VARIANTS[variant], className)}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
}

export function IconButton({ label, className, children, ...rest }: Omit<ButtonProps, 'icon'> & { label: string }) {
  return (
    <Button aria-label={label} title={label} variant="ghost" className={cn('size-11 min-h-11 rounded-full px-0', className)} {...rest}>
      {children}
    </Button>
  );
}

export function Chip({
  selected, onClick, children, className, swatch, disabled, title,
}: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string; swatch?: string; disabled?: boolean; title?: string }) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-pressed={selected}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-150 disabled:opacity-40',
        selected ? 'border-white bg-white text-black' : 'border-line bg-surface-2 text-fg',
        className,
      )}
    >
      {swatch && <span className="size-3.5 rounded-full border border-white/25" style={{ background: swatch }} />}
      {children}
    </motion.button>
  );
}
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block text-[15px]">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <span className={cn('flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'justify-end bg-white' : 'justify-start bg-surface-3')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cn('size-6 rounded-full', checked ? 'bg-black' : 'bg-white/70')} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, id }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="flex rounded-2xl border border-line bg-surface-2 p-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className="relative min-h-10 flex-1 rounded-xl px-3 text-sm">
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-white" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className={cn('relative', value === o.value ? 'text-black' : 'text-muted')}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Stars({ value, onChange, size = 'md', label = 'Rating' }: { value?: number; onChange?: (v: number) => void; size?: 'sm' | 'md'; label?: string }) {
  const px = size === 'sm' ? 14 : 26;
  return (
    <div className="flex items-center" role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? label : `${value ?? 0} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const star = <Star size={px} strokeWidth={1.6} className={on ? 'fill-white text-white' : 'text-white/30'} />;
        return onChange ? (
          <motion.button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} whileTap={{ scale: 0.85 }} onClick={() => { haptic(); onChange(n); }} className="grid size-11 place-items-center">
            {star}
          </motion.button>
        ) : (
          <span key={n} className="mr-0.5">{star}</span>
        );
      })}
    </div>
  );
}

/** Numbers count up when they appear. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion() || document.documentElement.dataset.reduceMotion === 'true';
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const c = animate(0, value, { duration: Math.min(0.9, 0.3 + value * 0.05), ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref} className={cn('tabular-nums', className)}>{shown}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('shimmer rounded-2xl', className)} />;
}

export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-6', className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between px-1">
          {title && <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-faint">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-line bg-surface p-4', className)}>{children}</div>;
}

export function Banner({ icon, children, action, tone = 'neutral' }: { icon?: ReactNode; children: ReactNode; action?: ReactNode; tone?: 'neutral' | 'warn' }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm', tone === 'warn' ? 'border-warn/30 bg-warn/10 text-warn' : 'border-line bg-surface-2')}>
      {icon}
      <div className="flex-1">{children}</div>
      {action}
    </motion.div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-16 place-items-center rounded-full border border-line bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      {children && <div className="mt-2 max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}
