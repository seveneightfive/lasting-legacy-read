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
import InsertImageDialog from './InsertImageDialog';
import { sanitizeWordPressHtml } from '../../utils/sanitizeWordPressHtml';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  contentClassName?: string;
  hideToolbar?: boolean;
  /** Book slug for upload folder */
  bookSlug?: string;
  /** When provided, the "Insert image" button shows an "Add to gallery" option that calls this */
  onAddToGallery?: (imageUrl: string, caption?: string) => Promise<void>;
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
  'min-h-[200px]',
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
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg my-4' },
        allowBase64: false,
      }),
    ],
    content: sanitizeWordPressHtml(normalizeToHtml(value)),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // Class must be a single-line string with no embedded whitespace tokens
        // (ProseMirror passes this to classList.add).
        class: [EDITOR_CLASS, contentClassName ?? '']
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    },
  });

  // Sync external value changes (e.g. when navigating to a different page)
  useEffect(() => {
    if (!editor) return;
    const incoming = sanitizeWordPressHtml(normalizeToHtml(value));
    if (editor.getHTML() !== incoming) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleInsertInline = (url: string, alt?: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: alt ?? '' })
      .createParagraphNear()
      .run();
  };

  const handleAddToGallery = async (url: string, caption?: string) => {
    if (onAddToGallery) await onAddToGallery(url, caption);
  };

  return (
    <div className="rich-text-editor">
      {!hideToolbar && (
        <EditorToolbar
          editor={editor}
          onClickInsertImage={bookSlug ? () => setShowImageDialog(true) : undefined}
        />
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
          onInsertInline={(url, alt) => {
            handleInsertInline(url, alt);
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
