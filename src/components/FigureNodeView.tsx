import React, { useRef, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';
import { RefreshCw, X, Loader2, Columns, Square } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

type Layout = 'single' | 'side-by-side';

interface FigureImage {
  src: string;
  alt?: string | null;
}

/**
 * Renders a figure inside the editor.
 *
 * What the user sees:
 *   - One or two images side-by-side, with a hover overlay over each.
 *   - The caption beneath is a real <figcaption> backed by ProseMirror content,
 *     so clicking and typing into it edits the document like any other text.
 *
 * Hover overlay buttons:
 *   - Replace this image (opens file picker)
 *   - Remove this image (single: removes the whole figure; 2-up: removes
 *     that one image and falls back to single layout)
 *
 * Top toolbar (visible whenever the figure is selected OR hovered):
 *   - Toggle layout (single ↔ side-by-side)
 *   - Delete figure
 *
 * The bookSlug comes from extension.options (set when the extension is
 * configured in RichTextEditor).
 */
export default function FigureNodeView({
  node, updateAttributes, deleteNode, editor, selected,
}: NodeViewProps) {
  const layout = (node.attrs.layout ?? 'single') as Layout;
  const images = (node.attrs.images ?? []) as FigureImage[];
  const bookSlug = (editor.extensionManager.extensions.find(
    (e) => e.name === 'figure'
  )?.options?.bookSlug ?? '') as string;

  const { upload, uploading } = useImageUpload({ folder: bookSlug });
  const [hovered, setHovered] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showControls = hovered || selected;

  const handleReplaceClick = (idx: number) => {
    setReplacingIndex(idx);
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (idx: number) => {
    if (images.length <= 1) {
      // Removing the only image = delete the whole figure
      deleteNode();
      return;
    }
    // Side-by-side with one removed → revert to single
    const remaining = images.filter((_, i) => i !== idx);
    updateAttributes({ images: remaining, layout: 'single' });
  };

  const handleAddSecondImage = useCallback(() => {
    setReplacingIndex(-1);  // -1 = appending, not replacing
    fileInputRef.current?.click();
  }, []);

  const handleAppendImage = async (file: File) => {
    const result = await upload(file);
    if (!result) return;
    updateAttributes({
      images: [...images, { src: result.publicUrl, alt: null }],
      layout: 'side-by-side',
    });
  };

  // Unified file change handler (replace OR append)
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      setReplacingIndex(null);
      return;
    }
    if (replacingIndex === -1) {
      await handleAppendImage(file);
    } else if (replacingIndex !== null) {
      const result = await upload(file);
      if (result) {
        const newImages = images.map((img, i) =>
          i === replacingIndex ? { ...img, src: result.publicUrl } : img
        );
        updateAttributes({ images: newImages });
      }
    }
    setReplacingIndex(null);
  };

  const toggleLayout = async () => {
    if (layout === 'single') {
      // Switching to side-by-side requires a second image
      handleAddSecondImage();
    } else {
      // Switching back to single — drop the second image
      updateAttributes({
        images: images.slice(0, 1),
        layout: 'single',
      });
    }
  };

  return (
    <NodeViewWrapper
      as="figure"
      data-layout={layout}
      className={`figure-node relative my-6 group
        ${layout === 'side-by-side' ? 'figure-grid-2' : ''}
        ${selected ? 'figure-selected' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Prevent the figure itself from being treated as a drop target by
      // other DnD handlers; the contenteditable caption still works.
      draggable={false}
    >
      {/* Selection toolbar — sits above the figure */}
      {showControls && (
        <div
          contentEditable={false}
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-10
            flex items-center gap-1 px-2 py-1 bg-slate-900 rounded-full shadow-lg"
        >
          <button
            type="button"
            onClick={toggleLayout}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-avenir text-white
              hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
            title={layout === 'single' ? 'Add a second image (side by side)' : 'Use a single image'}
          >
            {layout === 'single' ? <Columns size={12} /> : <Square size={12} />}
            {layout === 'single' ? 'Add 2nd image' : 'Single image'}
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <button
            type="button"
            onClick={() => deleteNode()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-avenir text-red-300
              hover:bg-slate-700 hover:text-red-200 rounded-full transition-colors"
            title="Delete figure"
          >
            <X size={12} />
            Delete
          </button>
        </div>
      )}

      {/* The images — contentEditable={false} so ProseMirror doesn't try to
          edit them; only the figcaption is editable */}
      <div
        contentEditable={false}
        className={`figure-images ${layout === 'side-by-side' ? 'grid grid-cols-2 gap-3' : ''}`}
      >
        {images.map((img, idx) => (
          <div key={`${idx}-${img.src}`} className="relative">
            <img
              src={img.src}
              alt={img.alt ?? ''}
              className="w-full rounded-lg"
            />
            {/* Per-image hover overlay */}
            {showControls && (
              <div className="absolute inset-0 flex items-center justify-center gap-2
                bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 pointer-events-none">
                <button
                  type="button"
                  onClick={() => handleReplaceClick(idx)}
                  disabled={uploading}
                  className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-white
                    text-slate-800 rounded-full text-xs font-avenir hover:bg-slate-100
                    transition-colors shadow-lg disabled:opacity-50"
                >
                  {uploading && replacingIndex === idx ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-white
                    text-red-700 rounded-full text-xs font-avenir hover:bg-red-50
                    transition-colors shadow-lg"
                >
                  <X size={12} />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}

        {/* "Add second image" placeholder when single but user clicked toggle */}
        {uploading && replacingIndex === -1 && layout === 'single' && (
          <div className="aspect-[4/3] flex items-center justify-center bg-slate-100 rounded-lg">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* THE EDITABLE CAPTION — this is real ProseMirror content */}
      <NodeViewContent
        as="figcaption"
        className="figure-caption"
        data-placeholder="Add a caption…"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="hidden"
      />
    </NodeViewWrapper>
  );
}
