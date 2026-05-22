import React, { useRef, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Node as PMNode } from '@tiptap/pm/model';
import {
  RefreshCw, X, Loader2, Columns, Square, Link2, MousePointerClick,
} from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { pairingMode } from '../../utils/pairingMode';
import { usePairingMode } from '../../hooks/usePairingMode';

type Layout = 'single' | 'side-by-side';

interface FigureImage {
  src: string;
  alt: string | null;
}

/**
 * Renders a figure inside the editor.
 *
 * Notable v6 changes:
 *   1. Toolbar is INSIDE the figure (top-2), not floating above with a hover
 *      gap. Closes the cursor-hover-bridge problem.
 *   2. New "Pair with..." button in the toolbar when layout === 'single':
 *      starts targeting mode. The next figure clicked becomes the partner;
 *      captions are joined with " — ".
 *   3. When this figure is a candidate target (another figure is the source
 *      and we're not it), the figure displays a "click to pair" overlay.
 */
export default function FigureNodeView({
  node, deleteNode, editor, selected, getPos,
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

  // ── State ──────────────────────────────────────────────────────
  const { upload, uploading } = useImageUpload({ folder: bookSlug });
  const [hovered, setHovered] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);

  const pairing = usePairingMode();
  const myPos = typeof getPos === 'function' ? getPos() : -1;
  const iAmPairingSource = pairing.sourcePos !== null && pairing.sourcePos === myPos;
  const someoneElseIsPairing = pairing.sourcePos !== null && pairing.sourcePos !== myPos;

  const showControls = (hovered || selected) && !pairing.sourcePos;

  // ── Image transactions (replace / remove / append) ─────────────
  const replaceImageAt = (idx: number, newSrc: string) => {
    if (myPos < 0) return;
    const tr = editor.state.tr;
    let offset = 1;
    let imgCount = 0;
    let targetPos = -1;
    let targetNode: PMNode | null = null;
    node.content.forEach((child) => {
      if (child.type.name === 'figureImage') {
        if (imgCount === idx) {
          targetPos = myPos + offset;
          targetNode = child;
        }
        imgCount++;
      }
      offset += child.nodeSize;
    });
    if (targetPos < 0 || !targetNode) return;
    tr.setNodeMarkup(targetPos, undefined, {
      src: newSrc,
      alt: (targetNode as PMNode).attrs.alt,
    });
    editor.view.dispatch(tr);
  };

  const removeImageAt = (idx: number) => {
    if (images.length <= 1) {
      deleteNode();
      return;
    }
    if (myPos < 0) return;
    const tr = editor.state.tr;
    let offset = 1;
    let imgCount = 0;
    let from = -1;
    let to = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureImage') {
        if (imgCount === idx) {
          from = myPos + offset;
          to = from + child.nodeSize;
        }
        imgCount++;
      }
      offset += child.nodeSize;
    });
    if (from < 0) return;
    tr.delete(from, to);
    tr.setNodeMarkup(myPos, undefined, { ...node.attrs, layout: 'single' });
    editor.view.dispatch(tr);
  };

  const appendImage = (src: string) => {
    if (myPos < 0) return;
    const tr = editor.state.tr;
    const schema = editor.schema;
    // Find position just before figureCaption (or end)
    let offset = 1;
    let insertAt = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureCaption' && insertAt < 0) {
        insertAt = myPos + offset;
      }
      offset += child.nodeSize;
    });
    if (insertAt < 0) insertAt = myPos + node.nodeSize - 1;
    const newImage = schema.nodes.figureImage.create({ src, alt: null });
    tr.insert(insertAt, newImage);
    tr.setNodeMarkup(myPos, undefined, { ...node.attrs, layout: 'side-by-side' });
    editor.view.dispatch(tr);
  };

  const updateCaption = (newText: string) => {
    if (myPos < 0) return;
    const tr = editor.state.tr;
    const schema = editor.schema;
    let offset = 1;
    let capFrom = -1;
    let capTo = -1;
    node.content.forEach((child) => {
      if (child.type.name === 'figureCaption') {
        capFrom = myPos + offset;
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

  // ── File picker ────────────────────────────────────────────────
  const handleReplaceClick = (idx: number) => {
    setReplacingIndex(idx);
    fileInputRef.current?.click();
  };

  const handleAddSecondImage = useCallback(() => {
    setReplacingIndex(-1);
    fileInputRef.current?.click();
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) { setReplacingIndex(null); return; }
    const result = await upload(file);
    if (!result) { setReplacingIndex(null); return; }
    if (replacingIndex === -1) appendImage(result.publicUrl);
    else if (replacingIndex !== null) replaceImageAt(replacingIndex, result.publicUrl);
    setReplacingIndex(null);
  };

  const toggleLayout = () => {
    if (layout === 'single') {
      handleAddSecondImage();
    } else {
      // Drop the second image
      if (myPos < 0) return;
      const tr = editor.state.tr;
      let offset = 1;
      let imgCount = 0;
      let from = -1;
      let to = -1;
      node.content.forEach((child) => {
        if (child.type.name === 'figureImage') {
          if (imgCount === 1) {
            from = myPos + offset;
            to = from + child.nodeSize;
          }
          imgCount++;
        }
        offset += child.nodeSize;
      });
      if (from >= 0) tr.delete(from, to);
      tr.setNodeMarkup(myPos, undefined, { ...node.attrs, layout: 'single' });
      editor.view.dispatch(tr);
    }
  };

  // ── PAIRING MODE ────────────────────────────────────────────────
  const startPairing = () => {
    if (myPos < 0) return;
    pairingMode.start(myPos);
  };

  const completePairing = () => {
    if (pairing.sourcePos === null || myPos < 0) return;
    if (pairing.sourcePos === myPos) return;

    // The source figure (the one that initiated pairing) and us (the target).
    // We'll merge them: combined figure goes at the source position.
    const doc = editor.state.doc;
    const sourceNode = doc.nodeAt(pairing.sourcePos);
    const targetNode = node;

    if (!sourceNode || sourceNode.type.name !== 'figure') {
      pairingMode.end();
      return;
    }

    // Read source's first image + caption
    let sourceImage: { src: string; alt: string | null } | null = null;
    let sourceCaption = '';
    sourceNode.content.forEach((c) => {
      if (c.type.name === 'figureImage' && !sourceImage) {
        sourceImage = { src: c.attrs.src ?? '', alt: c.attrs.alt ?? null };
      } else if (c.type.name === 'figureCaption') {
        sourceCaption = c.textContent;
      }
    });

    // Read target's first image + caption
    let targetImage: { src: string; alt: string | null } | null = null;
    let targetCaption = '';
    targetNode.content.forEach((c) => {
      if (c.type.name === 'figureImage' && !targetImage) {
        targetImage = { src: c.attrs.src ?? '', alt: c.attrs.alt ?? null };
      } else if (c.type.name === 'figureCaption') {
        targetCaption = c.textContent;
      }
    });

    if (!sourceImage || !targetImage) {
      pairingMode.end();
      return;
    }

    // Local references after the guard so TS knows they're non-null
    const srcImg: { src: string; alt: string | null } = sourceImage;
    const tgtImg: { src: string; alt: string | null } = targetImage;

    // Combine captions with " — "
    const combinedCaption = [sourceCaption.trim(), targetCaption.trim()]
      .filter(Boolean)
      .join(' \u2014 ');

    const schema = editor.schema;
    const mergedFigure = schema.nodes.figure.create(
      { layout: 'side-by-side' },
      [
        schema.nodes.figureImage.create(srcImg),
        schema.nodes.figureImage.create(tgtImg),
        combinedCaption
          ? schema.nodes.figureCaption.create({}, schema.text(combinedCaption))
          : schema.nodes.figureCaption.create({}),
      ]
    );

    // Build a transaction that deletes both originals and inserts the merged
    // figure at the source position. ProseMirror's Transaction does NOT
    // automatically remap positions across steps — we have to use
    // tr.mapping.map() to translate original positions to post-step positions.
    const tr = editor.state.tr;
    const sourcePos = pairing.sourcePos;
    const targetPos = myPos;

    // Step 1: delete the figure that comes LATER in the document.
    // This keeps positions before it valid for step 2.
    const [firstPos, firstSize, secondPos, secondSize] = targetPos > sourcePos
      ? [sourcePos, sourceNode.nodeSize, targetPos, targetNode.nodeSize]
      : [targetPos, targetNode.nodeSize, sourcePos, sourceNode.nodeSize];

    tr.delete(secondPos, secondPos + secondSize);

    // Step 2: replace the earlier figure (whose position is unchanged by step 1
    // because we only deleted content AFTER it) with the merged figure.
    tr.replaceWith(firstPos, firstPos + firstSize, mergedFigure);

    editor.view.dispatch(tr);
    pairingMode.end();
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <NodeViewWrapper
      as="figure"
      data-layout={layout}
      className={`figure-node relative my-6 group
        ${layout === 'side-by-side' ? 'figure-grid-2' : ''}
        ${selected ? 'figure-selected' : ''}
        ${iAmPairingSource ? 'figure-pairing-source' : ''}
        ${someoneElseIsPairing && layout === 'single' ? 'figure-pairing-target cursor-pointer' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        // If we're a candidate target in pairing mode, click = complete pair
        if (someoneElseIsPairing && layout === 'single') {
          e.preventDefault();
          e.stopPropagation();
          completePairing();
        }
      }}
    >
      {/* Pairing-mode source banner (shown on the source figure) */}
      {iAmPairingSource && (
        <div
          contentEditable={false}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20
            flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full shadow-lg text-sm font-avenir"
        >
          <Loader2 size={14} className="animate-pulse" />
          Click another single-image figure to pair with this one
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); pairingMode.end(); }}
            className="ml-1 text-white/80 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pairing-mode target hint (shown on candidate figures while hovered) */}
      {someoneElseIsPairing && layout === 'single' && hovered && (
        <div
          contentEditable={false}
          className="absolute inset-0 z-20 flex items-center justify-center
            bg-amber-500/30 rounded-lg pointer-events-none"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full shadow-lg text-sm font-avenir">
            <MousePointerClick size={14} />
            Click to pair with the other image
          </div>
        </div>
      )}

      {/* Normal toolbar — inside the figure, no hover gap */}
      {showControls && (
        <div
          contentEditable={false}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10
            flex items-center gap-1 px-2 py-1 bg-slate-900/85 backdrop-blur-sm
            rounded-full shadow-lg"
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

          {layout === 'single' && (
            <>
              <div className="w-px h-4 bg-slate-700" />
              <button
                type="button"
                onClick={startPairing}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-avenir text-white
                  hover:bg-slate-700 rounded-full transition-colors"
                title="Pair this image with another single image elsewhere in the story"
              >
                <Link2 size={12} />
                Pair with…
              </button>
            </>
          )}

          <div className="w-px h-4 bg-slate-700" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteNode(); }}
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
            {/* Per-image overlay (replace / remove) — hidden during pairing mode */}
            {showControls && (
              <div className="absolute inset-0 flex items-center justify-center gap-2
                bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReplaceClick(idx); }}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800
                    rounded-full text-xs font-avenir hover:bg-slate-100 shadow-lg disabled:opacity-50"
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
                  onClick={(e) => { e.stopPropagation(); removeImageAt(idx); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700
                    rounded-full text-xs font-avenir hover:bg-red-50 shadow-lg"
                >
                  <X size={12} />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Caption */}
      <input
        ref={captionInputRef}
        type="text"
        value={captionText}
        onChange={(e) => updateCaption(e.target.value)}
        placeholder="Add a caption…"
        // Don't let clicks on the caption bubble up and trigger pairing
        onClick={(e) => e.stopPropagation()}
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
