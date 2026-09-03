import React from 'react';
import { cx, initials, type SemanticToken } from '../../utils/format';

export type { SemanticToken };

/* -------------------------------------------------------------------------- */
/* Panel — the structural unit. Borders and rules, never floating cards.      */
/* -------------------------------------------------------------------------- */

interface PanelProps {
  title?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
  scroll?: boolean;
  /** Skip the content padding — for blocks that manage their own edges. */
  flush?: boolean;
}

export function Panel({ title, meta, actions, children, className, bare, scroll, flush }: PanelProps) {
  return (
    <section
      className={cx(
        'flex h-full min-h-0 flex-col',
        !bare && 'border border-[var(--card-border-color)] bg-[var(--surface-elevated)]',
        className
      )}
      style={{ borderRadius: bare ? undefined : 'var(--studio-radius)' }}>
      
      {(title || actions) &&
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-[var(--studio-pad)] py-2">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && <h2 className="t-label truncate">{title}</h2>}
            {meta && <span className="truncate text-2xs text-muted-foreground-subtle">{meta}</span>}
          </div>
          {actions}
        </header>
      }
      {/* Content flows naturally; the canvas frame measures it and grows the
           block so nothing is ever silently clipped. */}
      <div
        className={cx('min-h-0 flex-1', scroll && 'min-w-0')}
        style={{ padding: flush ? undefined : 'var(--studio-pad)' }}>
        
        {children}
      </div>
    </section>);

}

/* -------------------------------------------------------------------------- */
/* Chip — status and meaning. The only place colour is allowed to speak.      */
/* -------------------------------------------------------------------------- */

interface ChipProps {
  token?: SemanticToken;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Chip({ token = 'neutral', dot, children, className, title }: ChipProps) {
  const color =
  token === 'neutral' ?
  'var(--muted-foreground)' :
  token === 'accent' ?
  'var(--user-accent)' :
  `var(--${token})`;
  const bg =
  token === 'neutral' ?
  'var(--muted)' :
  token === 'accent' ?
  'var(--user-accent-subtle)' :
  `color-mix(in oklab, var(--${token}) 12%, transparent)`;
  return (
    <span
      title={title}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-2xs font-medium leading-none',
        className
      )}
      style={{
        color,
        backgroundColor: bg,
        borderColor: token === 'neutral' ? 'var(--border)' : `color-mix(in oklab, ${color} 30%, transparent)`
      }}>
      
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </span>);

}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({ name, src, size = 24 }: {name: string;src?: string | null;size?: number;}) {
  return src ?
  <img
    src={src}
    alt=""
    width={size}
    height={size}
    className="shrink-0 rounded-sm border border-border object-cover"
    style={{ width: size, height: size }} /> :


  <span
    aria-hidden
    className="flex shrink-0 items-center justify-center rounded-sm border border-border bg-[var(--surface-sunken)] font-mono font-medium text-muted-foreground"
    style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}>
    
      {initials(name)}
    </span>;

}

export function AvatarStack({
  people,
  max = 4



}: {people: Array<{id: string;display_name: string;avatar_url?: string | null;}>;max?: number;}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center gap-1">
      {shown.map((person) =>
      <span key={person.id} title={person.display_name}>
          <Avatar name={person.display_name} src={person.avatar_url} size={20} />
        </span>
      )}
      {rest > 0 && <span className="font-mono text-2xs text-muted-foreground">+{rest}</span>}
    </span>);

}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger' | 'accent';
}

export function IconButton({ label, active, tone = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        't-focus flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-muted-foreground',
        'hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active ?
        'border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent)]' :
        'border-transparent hover:border-border hover:bg-[var(--surface-sunken)]',
        tone === 'danger' && 'hover:!text-[var(--warning)]',
        className
      )}
      {...rest} />);


}

interface SegmentedProps<T extends string> {
  options: Array<{value: T;label: string;icon?: React.ReactNode;srLabel?: string;}>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  full?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  full
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex shrink-0 rounded-sm border border-border bg-[var(--surface-sunken)] p-0.5',
        full && 'w-full'
      )}>
      
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.srLabel ?? option.label}
            title={option.srLabel ?? option.label}
            onClick={() => onChange(option.value)}
            className={cx(
              't-focus flex flex-1 items-center justify-center gap-1.5 rounded-sm font-medium',
              size === 'sm' ? 'h-5 px-1.5 text-2xs' : 'h-6 px-2 text-xs',
              selected ?
              'bg-[var(--surface-elevated)] text-foreground shadow-lifted' :
              'text-muted-foreground hover:text-foreground'
            )}>
            
            {option.icon}
            {option.label}
          </button>);

      })}
    </div>);

}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        't-focus inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm border font-medium disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]',
        variant === 'primary' && 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
        variant === 'accent' &&
        'border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent)] hover:border-[var(--user-accent)]',
        variant === 'secondary' &&
        'border-border bg-[var(--surface-elevated)] text-foreground hover:border-border-strong hover:bg-[var(--surface-sunken)]',
        variant === 'ghost' && 'border-transparent text-muted-foreground hover:bg-[var(--surface-sunken)] hover:text-foreground',
        className
      )}
      {...rest} />);


}

export function Meter({ value, token = 'accent' }: {value: number;token?: SemanticToken;}) {
  const color = token === 'accent' ? 'var(--user-accent)' : `var(--${token})`;
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-sm bg-[var(--surface-sunken)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}>
      
      <div className="h-full rounded-sm" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>);

}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange





}: {label: string;hint?: string;checked: boolean;onChange: (next: boolean) => void;}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="block text-2xs text-muted-foreground-subtle">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          't-focus relative mt-0.5 h-4 w-7 shrink-0 rounded-sm border',
          checked ? 'border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]' : 'border-border bg-[var(--surface-sunken)]'
        )}>
        
        <span
          className="absolute top-0.5 h-2.5 w-2.5 rounded-sm transition-all duration-140"
          style={{
            left: checked ? '14px' : '2px',
            backgroundColor: checked ? 'var(--user-accent)' : 'var(--muted-foreground)'
          }} />
        
      </button>
    </label>);

}

export function EmptyHint({ children }: {children: React.ReactNode;}) {
  return (
    <p className="border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground-subtle" style={{ borderRadius: 'var(--studio-radius)' }}>
      {children}
    </p>);

}

export function Rule({ className }: {className?: string;}) {
  return <hr className={cx('border-0 border-t border-border', className)} />;
}