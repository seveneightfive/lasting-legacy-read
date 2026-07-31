import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { marked } from 'marked';
import EditorToolbar from './EditorToolbar';
import InsertImageDialog, { InlineFigureInsert } from './InsertImageDialog';
import { Figure } from './FigureExtension';
import { sanitizeWordPressHtml } from '../../utils/sanitizeWordPressHtml';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  contentClassName?: string;
  hideToolbar?: boolean;
  bookSlug?: string;
  onAddToGallery?: (imageUrl: string, caption?: string) => Promise<void>;
  stickyToolbar?: boolean;
}

function normalizeToHtml(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return trimmed;
  return marked.parse(content) as string;
}

const EDITOR_CLASS = [
  'markdown-body',
  'font-lora',
  'text-slate-800',
  'leading-body-relaxed',
  'body-tracking',
  'focus:outline-none',
  'min-h-[300px]',
  'p-4',
].join(' ');

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  contentClassName,
  hideToolbar = false,
  bookSlug,
  // Accepted for prop-compatibility with existing callers (PageEditView →
  // BookEditor's handleAddToGallery), but no longer used here: the
  // InsertImageDialog's gallery destination was retired — the only way to
  // build a page gallery now is the "Make this a photo page" toggle.
  onAddToGallery: _onAddToGallery,
  stickyToolbar = false,
}: RichTextEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Tracks whether the next `value` prop change is just this editor's own
  // edit echoing back through the parent's state, vs. a genuinely external
  // change (switching pages, an undo elsewhere, etc). See the effect below
  // for why this matters.
  const isInternalUpdate = useRef(false);

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
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing…',
      }),
      // Legacy standalone <img> tags from migrated content
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg my-4' },
        allowBase64: false,
      }),
      // Figure node — images live in attrs, caption is inline* content
      Figure.configure({ bookSlug: bookSlug ?? '' }),
    ],
    content: sanitizeWordPressHtml(normalizeToHtml(value)),
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      onChange(editor.getHTML());
    },
    editorProps: {
      scrollMargin: 80,
      scrollThreshold: 80,
      attributes: {
        class: [EDITOR_CLASS, contentClassName ?? '']
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    // Skip re-syncing content that just came FROM this editor via onUpdate.
    // `sanitizeWordPressHtml` runs unconditionally (not just on legacy
    // content) and isn't perfectly idempotent with live editing — e.g. it
    // strips the empty paragraph that Figure inserts after itself. If we
    // always re-synced on every `value` change, that mismatch would look
    // like an external edit and trigger a full `setContent()` reset right
    // after every keystroke/insert — discarding the live editor state
    // (cursor position, and in practice, content you just inserted, like
    // an image that hadn't visually settled yet). Only re-sync when the
    // change genuinely came from outside this editor instance.
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    const incoming = sanitizeWordPressHtml(normalizeToHtml(value));
    if (editor.getHTML() !== incoming) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleInsertInlineFigure = (figure: InlineFigureInsert) => {
    if (!editor) return;
    editor.chain().focus().insertFigure({
      layout: figure.layout,
      images: figure.images.map((img) => ({ src: img.src, alt: img.alt ?? null })),
      caption: figure.caption,
    }).run();
  };

  return (
    <div className="rich-text-editor">
      {!hideToolbar && (
        <div className={stickyToolbar ? 'sticky top-0 z-10 bg-white' : ''}>
          <EditorToolbar
            editor={editor}
            onClickInsertImage={bookSlug ? () => setShowImageDialog(true) : undefined}
          />
        </div>
      )}
      <div
        className={`border border-slate-200 bg-white
          ${hideToolbar ? 'rounded-lg' : 'rounded-b-lg border-t-0'}
          focus-within:ring-2 focus-within:ring-slate-300 focus-within:border-slate-300
          transition-shadow`}
      >
        <EditorContent editor={editor} />
      </div>

      {showImageDialog && bookSlug && (
        <InsertImageDialog
          bookSlug={bookSlug}
          onCancel={() => setShowImageDialog(false)}
          onInsertInline={(figure) => {
            handleInsertInlineFigure(figure);
            setShowImageDialog(false);
          }}
        />
      )}
    </div>
  );
}
