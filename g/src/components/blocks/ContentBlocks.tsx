import React, { useEffect, useRef, useState } from 'react';
import type { BlockProps } from '../../types/studio';
import { cx } from '../../utils/format';

interface InlineProps {
  value: string;
  editing: boolean;
  onCommit: (next: string) => void;
  className?: string;
  multiline?: boolean;
  ariaLabel: string;
}

/**
 * Inline editing where it belongs: the text is the input. No modal, no panel —
 * click the words and type. Commits on blur or ⌘↵, reverts on Escape.
 */
export function InlineText({ value, editing, onCommit, className, multiline, ariaLabel }: InlineProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (el && el instanceof HTMLTextAreaElement) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft, editing]);

  if (!editing) {
    return <span className={className}>{value}</span>;
  }

  const shared = {
    ref: ref as never,
    value: draft,
    'aria-label': ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(event.target.value),
    onBlur: () => draft !== value && onCommit(draft),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft(value);
        (event.target as HTMLElement).blur();
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        onCommit(draft);
        (event.target as HTMLElement).blur();
      }
    },
    className: cx(
      className,
      'w-full resize-none bg-transparent outline-none',
      'rounded-sm border border-dashed border-transparent px-1 -mx-1',
      'hover:border-border focus:border-[var(--user-accent-border)] focus:bg-[var(--user-accent-subtle)]'
    )
  };

  return multiline ? <textarea rows={1} {...shared} /> : <input type="text" {...shared} />;
}

export function ContentHeadingBlock({
  props,
  editing,
  onChange




}: {props: BlockProps;editing: boolean;onChange: (patch: BlockProps) => void;}) {
  return (
    <div className="flex h-full items-end pb-1">
      <h2 className="t-heading w-full text-[17px] font-semibold text-foreground">
        <InlineText
          ariaLabel="Heading text"
          value={props.text ?? 'Heading'}
          editing={editing}
          onCommit={(text) => onChange({ text })}
          className="t-heading text-[17px] font-semibold text-foreground" />
        
      </h2>
    </div>);

}

export function ContentTextBlock({
  props,
  editing,
  onChange




}: {props: BlockProps;editing: boolean;onChange: (patch: BlockProps) => void;}) {
  return (
    <div className="h-full overflow-y-auto t-scroll" style={{ maxWidth: 'var(--studio-measure)' }}>
      <InlineText
        multiline
        ariaLabel="Paragraph text"
        value={props.text ?? ''}
        editing={editing}
        onCommit={(text) => onChange({ text })}
        className="block text-[13px] leading-relaxed text-muted-foreground" />
      
    </div>);

}

export function ContentDividerBlock() {
  return (
    <div className="flex h-full items-center">
      <hr className="w-full border-0 border-t border-border" />
    </div>);

}