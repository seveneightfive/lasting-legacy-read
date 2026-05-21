import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  /** Show a small pencil icon hint when not editing */
  showHint?: boolean;
  /** Element to render when not editing (defaults to span / div) */
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3';
}

/**
 * A field that renders as plain text in the markup but becomes an
 * input/textarea when clicked. Used for titles, subtitles, captions, etc.
 */
export default function EditableText({
  value,
  onChange,
  placeholder = 'Click to edit…',
  className = '',
  multiline = false,
  showHint = true,
  as = 'div',
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at end
      const el = inputRef.current;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    const inputClasses = `w-full bg-yellow-50 border border-yellow-300 rounded px-2 py-1 ${className}`;
    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
        }}
        rows={2}
        className={inputClasses}
        placeholder={placeholder}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
          if (e.key === 'Enter') commit();
        }}
        className={inputClasses}
        placeholder={placeholder}
      />
    );
  }

  const Tag = as as keyof JSX.IntrinsicElements;
  const isEmpty = !value || value.trim() === '';

  return (
    <Tag
      onClick={() => setEditing(true)}
      className={`group cursor-text relative inline-block rounded
        hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-200 hover:ring-offset-1
        transition-all ${isEmpty ? 'text-slate-400 italic' : ''} ${className}`}
      title="Click to edit"
    >
      {isEmpty ? placeholder : value}
      {showHint && (
        <Pencil
          size={12}
          className="inline-block ml-1 opacity-0 group-hover:opacity-60 transition-opacity align-middle"
        />
      )}
    </Tag>
  );
}
