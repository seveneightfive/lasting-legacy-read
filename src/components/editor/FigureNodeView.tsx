import React, { useRef, useState, useCallback, useEffect } from 'react';
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';
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
 * v8 — rewritten to match the actual schema in FigureExtension.ts.
 *
 * Previous versions read child node types `figureImage` / `figureCaption`,
 * which were never registered. As a result the NodeView rendered an empty
 * figure shell while ProseMirror painted the underlying serialized DOM
 * (<img>s + <figcaption>) beneath it, causing the side-by-side caption
 * misalignment seen in production.
 *
 * Current schema:
 *   - images: in node.attrs.images (array of { src, alt })
 *   - caption: inline text content of the node itself
 *
 * So this NodeView:
 *   - reads images from attrs
 *   - uses <NodeViewContent as="figcaption"> for the editable caption
 *   - mutates images via tr.setNodeMarkup (attribute updates)
 *   - lets ProseMirror handle caption text natively (no manual textarea)
 */
export default function FigureNodeView({
  node, deleteNode, editor, getPos,
}: NodeViewProps) {
  const layout = (node.attrs.layout ?? 'single') as Layout;
  const images: FigureImage[] = (node.attrs.images ?? []) as FigureImage[];

  const bookSlug = (editor.extensionManager.extensions.find(
    (e) => e.name === 'figure'
  )?.options?.bookSlug ?? '') as string;

  // ── State ──────────────────────────────────────────────────────
  const { upload, uploading } = useImageUpload({ folder: bookSlug });
  const [hovered, setHovered] = useState(false);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pairing = usePairingMode();
  const myPos = typeof getPos === 'function' ? getPos() : -1;
  const iAmPairingSource = pairing.sourcePos !== null && pairing.sourcePos === myPos;
  const someoneElseIsPairing = pairing.sourcePos !== null && pairing.sourcePos !== myPos;

  // Defensive cleanup of stale pairing state on mount
  useEffect(() => {
    if (pairing.sourcePos !== null) {
      const sourceNode = editor.state.doc.nodeAt(pairing.sourcePos);
      if (!sourceNode || sourceNode.type.name !== 'figure') {
        pairingMode.end();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showControls = hovered && !pairing.sourcePos;
  const showPairingTargetUI = someoneElseIsPairing && layout === 'single' && hovered;

  // ── Image mutations via attribute updates ──────────────────────
  const updateAttrs = (newAttrs: Record<string, unknown>) => {
    if (myPos < 0) return;
    const tr = editor.state.tr.setNodeMarkup(myPos, undefined, {
      ...node.attrs,
      ...newAttrs,
    });
    editor.view.dispatch(tr);
  };

  const replaceImageAt = (idx: number, newSrc: string) => {
    const next = images.map((img, i) =>
      i === idx ? { src: newSrc, alt: img.alt } : img
    );
    updateAttrs({ images: next });
  };

  const removeImageAt = (idx: number) => {
    if (images.length <= 1) {
      deleteNode();
      return;
    }
    const next = images.filter((_, i) => i !== idx);
    updateAttrs({ images: next, layout: 'single' });
  };

  const appendImage = (src: string) => {
    const next = [...images, { src, alt: null }];
    updateAttrs({ images: next, layout: 'side-by-side' });
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
      // side-by-side → single: keep first image, drop the rest
      updateAttrs({
        images: images.slice(0, 1),
        layout: 'single',
      });
    }
  };

  // ── Pairing mode ───────────────────────────────────────────────
  const startPairing = () => {
    if (myPos < 0) return;
    pairingMode.start(myPos);
  };

  const completePairing = () => {
    if (pairing.sourcePos === null || myPos < 0) return;
    if (pairing.sourcePos === myPos) return;

    const doc = editor.state.doc;
    const sourceNode = doc.nodeAt(pairing.sourcePos);
    const targetNode = node;

    if (!sourceNode || sourceNode.type.name !== 'figure') {
      pairingMode.end();
      return;
    }

    const sourceImages = (sourceNode.attrs.images ?? []) as FigureImage[];
    const targetImages = (targetNode.attrs.images ?? []) as FigureImage[];
    const sourceCaption = sourceNode.textContent.trim();
    const targetCaption = targetNode.textContent.trim();

    if (sourceImages.length === 0 || targetImages.length === 0) {
      pairingMode.end();
      return;
    }

    const combinedCaption = [sourceCaption, targetCaption]
      .filter(Boolean)
      .join(' \u2014 ');

    const schema = editor.schema;
    const mergedFigure = schema.nodes.figure.create(
      {
        layout: 'side-by-side',
        images: [sourceImages[0], targetImages[0]],
      },
      combinedCaption ? schema.text(combinedCaption) : null
    );

    const tr = editor.state.tr;
    const sourcePos = pairing.sourcePos;
    const targetPos = myPos;

    const [firstPos, firstSize, secondPos, secondSize] = targetPos > sourcePos
      ? [sourcePos, sourceNode.nodeSize, targetPos, targetNode.nodeSize]
      : [targetPos, targetNode.nodeSize, sourcePos, sourceNode.nodeSize];

    // Delete the later one first so positions stay valid for the earlier replacement
    tr.delete(secondPos, secondPos + secondSize);
    tr.replaceWith(firstPos, firstPos + firstSize, mergedFigure);

    editor.view.dispatch(tr);
    pairingMode.end();
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <NodeViewWrapper
      as="figure"
      data-layout={layout}
      data-hovered={hovered ? 'true' : 'false'}
      data-pairing-source={iAmPairingSource ? 'true' : 'false'}
      data-pairing-target-candidate={someoneElseIsPairing && layout === 'single' ? 'true' : 'false'}
      className={`figure-node relative my-6
        ${iAmPairingSource ? 'figure-pairing-source' : ''}
        ${someoneElseIsPairing && layout === 'single' ? 'figure-pairing-target cursor-pointer' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredImageIndex(null); }}
      onClick={(e) => {
        if (someoneElseIsPairing && layout === 'single') {
          e.preventDefault();
          e.stopPropagation();
          completePairing();
        }
      }}
    >
      {/* Source banner */}
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

      {/* Pairing target hint */}
      {showPairingTargetUI && (
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

      {/* Main toolbar */}
      {showControls && (
        <div
          contentEditable={false}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10
            flex items-center gap-1 px-2 py-1 bg-slate-900/85 backdrop-blur-sm
            rounded-full shadow-lg"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleLayout(); }}
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
                onClick={(e) => { e.stopPropagation(); startPairing(); }}
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

      {/* Images — block of its own, above the caption */}
      <div
        contentEditable={false}
        className={`figure-images ${layout === 'side-by-side' ? 'grid grid-cols-2 gap-3' : ''}`}
      >
        {images.map((img, idx) => (
          <div
            key={`${idx}-${img.src}`}
            className="relative"
            onMouseEnter={() => setHoveredImageIndex(idx)}
            onMouseLeave={() => setHoveredImageIndex(null)}
          >
            <img src={img.src} alt={img.alt ?? ''} className="w-full rounded-lg" />
            {hoveredImageIndex === idx && !pairing.sourcePos && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 transition-colors">
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

      {/* Caption — editable inline ProseMirror content, sibling of images
          (NOT a flex child). Renders as a block <figcaption> below the
          images regardless of layout. */}
      <NodeViewContent
        as="figcaption"
        className="figure-caption block w-full mt-3 px-2 text-sm font-lora italic text-slate-600 text-center"
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
