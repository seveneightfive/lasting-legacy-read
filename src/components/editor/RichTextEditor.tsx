import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import EditorToolbar from './EditorToolbar';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Additional class names applied to the editable content area */
  contentClassName?: string;
  /** When true, hides the toolbar (used for shorter fields like quotes) */
  hideToolbar?: boolean;
}

/**
 * Converts incoming content (which may be HTML or Markdown) to HTML
 * so TipTap can render it consistently.
 */
function normalizeToHtml(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return trimmed;
  return marked.parse(content) as string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  contentClassName = '',
  hideToolbar = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
    ],
    content: normalizeToHtml(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // IMPORTANT: must be a single-line string with no newlines/tabs.
        // ProseMirror passes this to classList.add(), which throws
        // DOMException if any token contains whitespace.
        class: [
          'markdown-body',
          'font-lora',
          'text-slate-800',
          'leading-body-relaxed',
          'body-tracking',
          'focus:outline-none',
          'min-h-[200px]',
          'p-4',
          contentClassName,
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      },
    },
  });

  // Sync external value changes (e.g. when navigating to a different page)
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeToHtml(value);
    if (editor.getHTML() !== incoming) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div className="rich-text-editor">
      {!hideToolbar && <EditorToolbar editor={editor} />}
      <div
        className={`border border-slate-200 bg-white
          ${hideToolbar ? 'rounded-lg' : 'rounded-b-lg border-t-0'}
          focus-within:ring-2 focus-within:ring-slate-300 focus-within:border-slate-300
          transition-shadow`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
