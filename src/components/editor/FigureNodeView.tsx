import React, { useRef, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { RefreshCw, X, Loader2, Columns, Square } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

type Layout = 'single' | 'side-by-side';

interface FigureImage {
  src: string;
  alt: string | null;
}

/**
 * Renders a figure inside the editor.
 *
 * The figure has child nodes: 1+ figureImage nodes followed by an optional
 * figureCaption node. We iterate over node.content to find the images and
 * the caption position, then:
 *   - Render the images via React (with hover overlays for replace/remove)
 *   - Embed the caption as a contentEditable that targets the figureCaption
 *     position via a ProseMirror transaction-aware wrapper
 *
 * For the caption: since v5's schema has figureCaption as a real node with
 * content, ProseMirror handles its editing natively. We render an empty
 * <figcaption> ourselves, and use a contentDOM ref to tell ProseMirror where
 * to render the editable content.
 *
 * WAIT — there's a simpler approach: use <NodeViewContent /> for the WHOLE
 * figure body and let ProseMirror render the images + caption as it normally
 * would. But then we lose the hover overlays.
 *
 * The right balance: NodeViewWrapper for the <figure>; render images as
 * React elements (with overlays) BUT also include a contentDOM that
 * ProseMirror writes the figureCaption into. We achieve this by using a
 * specific ref pattern: contentDOM is a hidden container that holds
 * children #2+ (just the caption), while we manually render images for
 * children #1..N-1.
 *
 * Actually the cleanest pattern for "atom-like body + editable trailing
 * caption" is to have a NodeView that doesn't use contentDOM at all, and
 * use a separate <input> for the caption that calls a ProseMirror
 * transaction to update the caption text. That avoids fighting the
 * NodeView/contentDOM interactions.
 *
 * Going with the input approach — simpler, more reliable.
 */
export default function FigureNodeView({
  node, updateAttributes, deleteNode, editor, selected, getPos,
}: NodeViewProps) {
  const layout = (node.attrs.layout ?? 'single') as Layout;
  const bookSlug = (editor.extensionManager.extensions.find(
    (e) => e.name === 'figure'
  )?.options?.bookSlug ?? '') as string;

  // ── Read children from the node ────────────────────────────────
  const images: FigureImage[] = [];
  let captionText = '';

  node.content.forEach((child) => {
    if (child.type.name === 'figureImage') {
      images.push({
        src: child.attrs.src ?? '',
        alt: child.attrs.alt ?? null,
      });
    } else if (child.type.name === 'figureCaption') {
      captionText = child.textContent;
    }
  });

  // ── State for replace/append flow ──────────────────────────────
  const { upload, uploading } = useImageUpload({ folder: bookSlug });
  const [hovered, setHovered] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);

  const showControls = hovered || selected;

  // ── Image manipulation via ProseMirror transactions ────────────
  const replaceImageAt = (idx: number, newSrc: string) => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    const tr = editor.state.tr;

    // Walk children to find the position of the image at index `idx`
    let offset = 1; // +1 to step inside the figure node
    let imgCount = 0;
    let targetPos = -1;
    let targetNode = null as ReturnType<typeof node.content.firstChild>;
    node.content.forEach((child, _offset) => {
      if (child.type.name === 'figureImage') {
        if (imgCount === idx) {
          targetPos = pos + offset;
          targetNode = child;
        }
        imgCount++;
      }
      offset += child.nodeSize;
    });

    if (targetPos < 0 || !targetNode) return;
    tr.setNodeMarkup(targetPos, undefined, { src: newSrc, alt: targetNode.attrs.alt });
    editor.view.dispatch(tr);
  };

  const removeImageAt = (idx: number) => {
    if (images.length <= 1) {
      deleteNode();
      return;
    }
    if (typeof getPos !== 'function') return;

    const pos = getPos();
    const tr = editor.state.tr;
    let offset = 1;
    let imgCount = 0;
    let targetFrom = -1;
    let targetTo = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureImage') {
        if (imgCount === idx) {
          targetFrom = pos + offset;
          targetTo = targetFrom + child.nodeSize;
        }
        imgCount++;
      }
      offset += child.nodeSize;
    });
    if (targetFrom < 0) return;
    tr.delete(targetFrom, targetTo);
    // Also switch back to single layout
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout: 'single' });
    editor.view.dispatch(tr);
  };

  const appendImage = (src: string) => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    const tr = editor.state.tr;
    const schema = editor.schema;

    // Find the position right before the figureCaption (or at the end if no caption)
    let offset = 1;
    let insertAt = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureCaption' && insertAt < 0) {
        insertAt = pos + offset;
      }
      offset += child.nodeSize;
    });
    if (insertAt < 0) insertAt = pos + node.nodeSize - 1;

    const newImage = schema.nodes.figureImage.create({ src, alt: null });
    tr.insert(insertAt, newImage);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout: 'side-by-side' });
    editor.view.dispatch(tr);
  };

  // ── Caption editing via transaction ────────────────────────────
  const updateCaption = (newText: string) => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    const tr = editor.state.tr;
    const schema = editor.schema;

    // Find the figureCaption position
    let offset = 1;
    let capFrom = -1;
    let capTo = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureCaption') {
        capFrom = pos + offset;
        capTo = capFrom + child.nodeSize;
      }
      offset += child.nodeSize;
    });

    if (capFrom < 0) return;
    const newCaption = newText.trim()
      ? schema.nodes.figureCaption.create({}, schema.text(newText))
      : schema.nodes.figureCaption.create({});
    tr.replaceWith(capFrom, capTo, newCaption);
    editor.view.dispatch(tr);
  };

  // ── File picker dispatch ───────────────────────────────────────
  const handleReplaceClick = (idx: number) => {
    setReplacingIndex(idx);
    fileInputRef.current?.click();
  };

  const handleAddSecondImage = useCallback(() => {
    setReplacingIndex(-1); // -1 = appending
    fileInputRef.current?.click();
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      setReplacingIndex(null);
      return;
    }
    const result = await upload(file);
    if (!result) {
      setReplacingIndex(null);
      return;
    }
    if (replacingIndex === -1) {
      appendImage(result.publicUrl);
    } else if (replacingIndex !== null) {
      replaceImageAt(replacingIndex, result.publicUrl);
    }
    setReplacingIndex(null);
  };

  const toggleLayout = () => {
    if (layout === 'single') {
      handleAddSecondImage();
    } else {
      // Drop the second image
      if (typeof getPos === 'function') {
        const pos = getPos();
        const tr = editor.state.tr;
        let offset = 1;
        let imgCount = 0;
        let secondImgFrom = -1;
        let secondImgTo = -1;
        node.content.forEach((child) => {
          if (child.type.name === 'figureImage') {
            if (imgCount === 1) {
              secondImgFrom = pos + offset;
              secondImgTo = secondImgFrom + child.nodeSize;
            }
            imgCount++;
          }
          offset += child.nodeSize;
        });
        if (secondImgFrom >= 0) tr.delete(secondImgFrom, secondImgTo);
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout: 'single' });
        editor.view.dispatch(tr);
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <NodeViewWrapper
      as="figure"
      data-layout={layout}
      className={`figure-node relative my-6 group
        ${layout === 'side-by-side' ? 'figure-grid-2' : ''}
        ${selected ? 'figure-selected' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Selection toolbar */}
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
          >
            <X size={12} />
            Delete
          </button>
        </div>
      )}

      {/* Images */}
      <div
        contentEditable={false}
        className={`figure-images ${layout === 'side-by-side' ? 'grid grid-cols-2 gap-3' : ''}`}
      >
        {images.map((img, idx) => (
          <div key={`${idx}-${img.src}`} className="relative">
            <img src={img.src} alt={img.alt ?? ''} className="w-full rounded-lg" />
            {showControls && (
              <div className="absolute inset-0 flex items-center justify-center gap-2
                bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleReplaceClick(idx)}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 rounded-full text-xs font-avenir hover:bg-slate-100 shadow-lg disabled:opacity-50"
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
                  onClick={() => removeImageAt(idx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 rounded-full text-xs font-avenir hover:bg-red-50 shadow-lg"
                >
                  <X size={12} />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Caption — controlled <input> that writes back via ProseMirror txn */}
      <input
        ref={captionInputRef}
        contentEditable={false}  // we manage input editing ourselves
        type="text"
        value={captionText}
        onChange={(e) => updateCaption(e.target.value)}
        placeholder="Add a caption…"
        className="figure-caption-input w-full mt-2 px-2 py-1 text-sm font-lora italic text-slate-600 text-center
          bg-transparent border-0 border-b border-transparent
          hover:border-slate-200 focus:border-slate-400 focus:outline-none
          placeholder:text-slate-400 placeholder:not-italic transition-colors"
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
