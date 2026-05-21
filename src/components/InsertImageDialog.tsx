import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Loader2, ImageIcon, AlignLeft, LayoutGrid,
  Square, Columns,
} from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

type Destination = 'inline' | 'gallery';
type Layout = 'single' | 'side-by-side';

export interface InlineFigureInsert {
  layout: Layout;
  images: Array<{ src: string; alt?: string }>;
  caption?: string;
}

interface InsertImageDialogProps {
  bookSlug: string;
  allowGallery: boolean;
  onCancel: () => void;
  /** Called when user picks Inline. Receives a full figure spec. */
  onInsertInline: (figure: InlineFigureInsert) => void;
  /** Called when user picks Gallery (single image). */
  onAddToGallery: (url: string, caption?: string) => Promise<void>;
}

/**
 * Multi-step modal:
 *   1. Destination — inline vs gallery (skipped if !allowGallery)
 *   2. If inline → Layout — single or side-by-side
 *   3. Upload 1 or 2 images + optional caption
 *
 * Gallery items are always single images (the page gallery is a grid of
 * individual photos — no need to nest grids inside grids).
 */
export default function InsertImageDialog({
  bookSlug, allowGallery, onCancel, onInsertInline, onAddToGallery,
}: InsertImageDialogProps) {
  // Step state
  const [destination, setDestination] = useState<Destination | null>(
    allowGallery ? null : 'inline'
  );
  const [layout, setLayout] = useState<Layout | null>(null);

  // Files for each slot (1 for single, 2 for side-by-side)
  const [files, setFiles] = useState<(File | null)[]>([null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null]);
  const [caption, setCaption] = useState('');

  const [activeSlot, setActiveSlot] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, error, clearError } = useImageUpload({ folder: bookSlug });

  // ── Step helpers ─────────────────────────────────────────────
  const pickDestination = (d: Destination) => {
    setDestination(d);
    if (d === 'gallery') {
      // Gallery is always single
      setLayout('single');
      setFiles([null]);
      setPreviews([null]);
    }
  };

  const pickLayout = (l: Layout) => {
    setLayout(l);
    const slots = l === 'side-by-side' ? 2 : 1;
    setFiles(Array(slots).fill(null));
    setPreviews(Array(slots).fill(null));
  };

  // ── File picking ─────────────────────────────────────────────
  const assignFile = (idx: number, file: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      next[idx] = URL.createObjectURL(file);
      return next;
    });
    clearError();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) assignFile(activeSlot, f);
    e.target.value = '';
  };

  const onDrop = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    const f = e.dataTransfer.files?.[0];
    if (f) assignFile(idx, f);
  }, []);

  const openPicker = (idx: number) => {
    setActiveSlot(idx);
    fileInputRef.current?.click();
  };

  // ── Submission ───────────────────────────────────────────────
  const allFilesReady = files.every((f) => f !== null);

  const handleInsert = async () => {
    if (!destination || !allFilesReady) return;
    setSubmitting(true);

    try {
      // Upload all selected files in parallel
      const uploads = await Promise.all(
        (files as File[]).map((f) => upload(f))
      );
      if (uploads.some((u) => !u)) {
        setSubmitting(false);
        return;
      }
      const urls = uploads.map((u) => u!.publicUrl);

      if (destination === 'inline' && layout) {
        onInsertInline({
          layout,
          images: urls.map((src) => ({ src, alt: caption || undefined })),
          caption: caption || undefined,
        });
      } else if (destination === 'gallery') {
        // Gallery only supports single image
        await onAddToGallery(urls[0], caption);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = uploading || submitting;
  const showLayoutStep = destination === 'inline' && !layout && allowGallery;
  const showSingleStepLayout = destination === 'inline' && !layout && !allowGallery;

  // ── Render ───────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto"
        >
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cancel"
          >
            <X size={20} />
          </button>

          <h2 className="text-xl font-avenir text-slate-800 mb-1 heading-tracking">
            Insert image
          </h2>
          <p className="text-sm text-slate-500 font-avenir mb-5">
            {!destination ? 'Where should this image go?' :
             !layout && destination === 'inline' ? 'Choose a layout for the image(s).' :
             destination === 'inline'
               ? layout === 'side-by-side' ? 'Add two photos that will appear side by side.' : 'Add a photo to appear inline with the prose.'
               : 'Add a photo to this page\u2019s gallery.'}
          </p>

          {/* ── Step 1: destination ──────────────────────────── */}
          {!destination && allowGallery && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => pickDestination('inline')}
                className="flex flex-col items-center text-center p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                  <AlignLeft size={20} className="text-amber-700" />
                </div>
                <span className="font-avenir text-slate-800 mb-1">Inline in story</span>
                <span className="text-xs text-slate-500 font-avenir">Mixed with the prose</span>
              </button>
              <button
                onClick={() => pickDestination('gallery')}
                className="flex flex-col items-center text-center p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <LayoutGrid size={20} className="text-slate-700" />
                </div>
                <span className="font-avenir text-slate-800 mb-1">Page gallery</span>
                <span className="text-xs text-slate-500 font-avenir">Grid below the story</span>
              </button>
            </div>
          )}

          {/* ── Step 2: layout (inline only) ────────────────── */}
          {(showLayoutStep || showSingleStepLayout) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => pickLayout('single')}
                className="flex flex-col items-center text-center p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                  <Square size={20} className="text-slate-700" />
                </div>
                <span className="font-avenir text-slate-800 mb-1">Single image</span>
                <span className="text-xs text-slate-500 font-avenir">One photo across the column</span>
              </button>
              <button
                onClick={() => pickLayout('side-by-side')}
                className="flex flex-col items-center text-center p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                  <Columns size={20} className="text-slate-700" />
                </div>
                <span className="font-avenir text-slate-800 mb-1">Side by side</span>
                <span className="text-xs text-slate-500 font-avenir">Two photos with a shared caption</span>
              </button>
            </div>
          )}

          {/* ── Step 3: upload + caption ────────────────────── */}
          {destination && layout && (
            <div>
              <div className={`grid gap-3 mb-4 ${files.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {files.map((file, idx) => {
                  const preview = previews[idx];
                  const isDragOver = dragOverSlot === idx;
                  return (
                    <div key={idx}>
                      {preview ? (
                        <div className="relative rounded-xl overflow-hidden bg-slate-100">
                          <img src={preview} alt="" className="w-full aspect-[4/3] object-cover" />
                          <button
                            type="button"
                            onClick={() => openPicker(idx)}
                            className="absolute top-2 right-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-xs font-avenir text-slate-700 hover:bg-white shadow"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openPicker(idx)}
                          onKeyDown={(e) => { if (e.key === 'Enter') openPicker(idx); }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverSlot(idx); }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => onDrop(idx, e)}
                          className={`flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed rounded-xl cursor-pointer transition-colors
                            ${isDragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                        >
                          <ImageIcon size={24} className="text-slate-400 mb-2" />
                          <p className="text-xs font-avenir text-slate-700">
                            {files.length === 2 ? `Photo ${idx + 1}` : 'Drop or click'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {allFilesReady && (
                <label className="block mb-3">
                  <span className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-1.5">
                    {destination === 'gallery' ? 'Caption' : (files.length === 2 ? 'Shared caption' : 'Caption')}
                  </span>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={files.length === 2 ? 'A caption that describes both photos' : 'Optional caption (shown below the image)'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-lora text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
                  />
                </label>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-700 font-avenir">{error}</p>
              )}

              <div className="flex justify-between items-center mt-5">
                <button
                  onClick={() => {
                    if (layout) { setLayout(null); setFiles([null]); setPreviews([null]); }
                    else if (allowGallery) setDestination(null);
                  }}
                  disabled={busy}
                  className="text-sm font-avenir text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    disabled={busy}
                    className="px-4 py-2 text-sm font-avenir text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInsert}
                    disabled={!allFilesReady || busy}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-full text-sm font-avenir hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {busy ? 'Uploading…' : 'Insert'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
            className="hidden"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
