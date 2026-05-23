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
 * v8 — images are rendered by ProseMirror from the schema's renderHTML,
 * NOT by React. The previous version tried to paint images in React
 * which conflicted with ProseMirror's own rendering of the schema
 * content, resulting in images ending up inside the figcaption.
 *
 * Current architecture:
 *   - Schema renderHTML produces: <figure> <img> <img> <figcaption /> </figure>
 *   - The NodeView wraps that and adds: toolbar, hover overlays, caption placeholder
 *   - CSS uses `display: grid` on the figure itself for side-by-side layout
 *   - The figcaption uses NodeViewContent so the caption text remains editable
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
        ${layout === 'side-by-side' ? 'figure-grid-2' : ''}
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
      {/* Pairing source banner */}
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
          className="figure-toolbar absolute top-2 left-1/2 -translate-x-1/2 z-10
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

      {/* Caption — editable inline ProseMirror content with a sibling
          placeholder shown when empty. ProseMirror also renders the
          schema's <img> children directly into the figure here; the
          NodeViewContent below anchors the caption to its own slot. */}
      <div className="figure-caption-wrapper relative">
        {node.textContent.trim() === '' && (
          <div
            contentEditable={false}
            className="absolute inset-x-0 top-1 text-center text-sm font-lora italic text-slate-300 pointer-events-none"
          >
            Add a caption…
          </div>
        )}
        <NodeViewContent
          as="figcaption"
          className="figure-caption"
        />
      </div>

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
