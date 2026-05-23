import React, { useEffect, useState } from 'react';
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
  onAddToGallery,
  stickyToolbar = false,
}: RichTextEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);

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

  const handleAddToGallery = async (url: string, caption?: string) => {
    if (onAddToGallery) await onAddToGallery(url, caption);
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
          allowGallery={!!onAddToGallery}
          onCancel={() => setShowImageDialog(false)}
          onInsertInline={(figure) => {
            handleInsertInlineFigure(figure);
            setShowImageDialog(false);
          }}
          onAddToGallery={async (url, caption) => {
            await handleAddToGallery(url, caption);
            setShowImageDialog(false);
          }}
        />
      )}
    </div>
  );
}
