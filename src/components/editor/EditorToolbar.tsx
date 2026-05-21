import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Undo, Redo, Image as ImageIcon,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  /** Optional handler — when provided, an Image button appears in the toolbar */
  onClickInsertImage?: () => void;
}

interface ToolButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}

function ToolButton({ onClick, active, disabled, label, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-2 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed
        ${active
          ? 'bg-slate-800 text-white'
          : 'text-slate-700 hover:bg-slate-100'
        }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-slate-200 mx-1" />;
}

export default function EditorToolbar({ editor, onClickInsertImage }: EditorToolbarProps) {
  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('URL', previous ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border border-slate-200 rounded-t-lg bg-slate-50">
      <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold">
        <Bold size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic">
        <Italic size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Underline">
        <UnderlineIcon size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="Strikethrough">
        <Strikethrough size={16} />
      </ToolButton>

      <Divider />

      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="Heading 1">
        <Heading1 size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="Heading 2">
        <Heading2 size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="Heading 3">
        <Heading3 size={16} />
      </ToolButton>

      <Divider />

      <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Bullet list">
        <List size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Numbered list">
        <ListOrdered size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Blockquote">
        <Quote size={16} />
      </ToolButton>

      <Divider />

      <ToolButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Align left">
        <AlignLeft size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Align center">
        <AlignCenter size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Align right">
        <AlignRight size={16} />
      </ToolButton>

      <Divider />

      <ToolButton onClick={setLink} active={editor.isActive('link')} label="Add link">
        <LinkIcon size={16} />
      </ToolButton>

      {onClickInsertImage && (
        <ToolButton onClick={onClickInsertImage} label="Insert image">
          <ImageIcon size={16} />
        </ToolButton>
      )}

      <Divider />

      <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} label="Undo">
        <Undo size={16} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} label="Redo">
        <Redo size={16} />
      </ToolButton>
    </div>
  );
}
