import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Loader2, ImageIcon,
  Square, Columns, Images, UploadCloud,
} from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { supabase } from '../../lib/supabase';

type Destination = 'inline' | 'gallery';
type Layout = 'single' | 'side-by-side';
type SourceTab = 'upload' | 'library';

export interface InlineFigureInsert {
  layout: Layout;
  images: Array<{ src: string; alt?: string }>;
  caption?: string;
}

interface LibraryPhoto {
  id: number;
  image_url: string;
  caption: string | null;
}

/** A slot can hold a freshly-picked local file (needs uploading) or an
 *  already-hosted library photo (just reuse the URL, no upload needed). */
type SlotValue =
  | { kind: 'upload'; file: File; preview: string }
  | { kind: 'library'; url: string; preview: string }
  | null;

interface InsertImageDialogProps {
  bookSlug: string;
  onCancel: () => void;
  /** Called on Insert. Receives a full figure spec. */
  onInsertInline: (figure: InlineFigureInsert) => void;
}

/**
 * Modal steps:
 *   1. Layout — single or side-by-side
 *   2. Fill each slot — either upload a new photo, or reuse one from
 *      the book's photo library — plus an optional caption.
 *
 * Gallery/photo-page images are handled elsewhere now (the "Make this a
 * photo page" toggle) — this dialog only ever inserts inline figures.
 */
export default function InsertImageDialog({
  bookSlug, onCancel, onInsertInline,
}: InsertImageDialogProps) {
  // destination is always 'inline' — kept as a tiny piece of state rather
  // than a plain constant only so the rest of this file (written when a
  // gallery destination also existed) didn't need a larger rewrite.
  const [destination] = useState<Destination | null>('inline');
  const [layout, setLayout] = useState<Layout | null>(null);

  // Slots for each image (1 for single, 2 for side-by-side)
  const [slots, setSlots] = useState<SlotValue[]>([null]);
  const [caption, setCaption] = useState('');

  const [sourceTab, setSourceTab] = useState<SourceTab>('upload');
  const [activeSlot, setActiveSlot] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library photos (for this book), loaded lazily when the tab is opened.
  const [libraryPhotos, setLibraryPhotos] = useState<LibraryPhoto[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const { upload, uploading, error, clearError } = useImageUpload({ folder: bookSlug });

  const loadLibrary = useCallback(async () => {
    if (libraryPhotos !== null || libraryLoading) return;
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('photo_library')
        .select('id, image_url, caption')
        .eq('book_slug', bookSlug)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setLibraryPhotos(data ?? []);
    } catch (err: any) {
      setLibraryError(err?.message || 'Could not load your photo library.');
      setLibraryPhotos([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [bookSlug, libraryPhotos, libraryLoading]);

  // ── Step helpers ─────────────────────────────────────────────

  const pickLayout = (l: Layout) => {
    setLayout(l);
    const count = l === 'side-by-side' ? 2 : 1;
    setSlots(Array(count).fill(null));
  };

  // ── File picking ─────────────────────────────────────────────
  const assignFile = (idx: number, file: File) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: 'upload', file, preview: URL.createObjectURL(file) };
      return next;
    });
    clearError();
  };

  const assignLibraryPhoto = (idx: number, photo: LibraryPhoto) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: 'library', url: photo.image_url, preview: photo.image_url };
      return next;
    });
    if (photo.caption && !caption) setCaption(photo.caption);
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

  const openSlotFor = (idx: number) => {
    setActiveSlot(idx);
    if (sourceTab === 'library') {
      void loadLibrary();
    } else {
      openPicker(idx);
    }
  };

  // ── Submission ───────────────────────────────────────────────
  const allSlotsReady = slots.every((s) => s !== null);

  const handleInsert = async () => {
    if (!destination || !allSlotsReady) return;
    setSubmitting(true);

    try {
      // Resolve each slot to a public URL — upload fresh files, reuse
      // library URLs as-is (no upload needed).
      const resolved = await Promise.all(
        (slots as Exclude<SlotValue, null>[]).map(async (slot) => {
          if (slot.kind === 'library') return slot.url;
          const result = await upload(slot.file);
          return result?.publicUrl ?? null;
        })
      );
      if (resolved.some((u) => !u)) {
        setSubmitting(false);
        return;
      }
      const urls = resolved as string[];

      if (layout) {
        onInsertInline({
          layout,
          images: urls.map((src) => ({ src, alt: caption || undefined })),
          caption: caption || undefined,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = uploading || submitting;
  const showLayoutStep = !layout;

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
            {!layout ? 'Choose a layout for the image(s).' :
             layout === 'side-by-side' ? 'Add two photos that will appear side by side.' : 'Add a photo to appear inline with the prose.'}
          </p>

          {/* ── Step 2: layout ───────────────────────────────── */}
          {showLayoutStep && (
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

          {/* ── Step 3: fill slots + caption ────────────────── */}
          {destination && layout && (
            <div>
              {/* Source tabs */}
              <div className="flex items-center gap-1 mb-3 p-1 bg-slate-100 rounded-full w-fit">
                <button
                  type="button"
                  onClick={() => setSourceTab('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-avenir transition-colors
                    ${sourceTab === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <UploadCloud size={13} />
                  Upload new
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceTab('library'); void loadLibrary(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-avenir transition-colors
                    ${sourceTab === 'library' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Images size={13} />
                  From your library
                </button>
              </div>

              {/* Slot thumbnails (always visible so you can see what's picked so far) */}
              <div className={`grid gap-3 mb-4 ${slots.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {slots.map((slot, idx) => {
                  const isDragOver = dragOverSlot === idx;
                  return (
                    <div key={idx}>
                      {slot ? (
                        <div className="relative rounded-xl overflow-hidden bg-slate-100">
                          <img src={slot.preview} alt="" className="w-full aspect-[4/3] object-cover" />
                          <button
                            type="button"
                            onClick={() => { setActiveSlot(idx); }}
                            className="absolute top-2 right-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-xs font-avenir text-slate-700 hover:bg-white shadow"
                          >
                            Change
                          </button>
                        </div>
                      ) : sourceTab === 'upload' ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openSlotFor(idx)}
                          onKeyDown={(e) => { if (e.key === 'Enter') openSlotFor(idx); }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverSlot(idx); }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => onDrop(idx, e)}
                          className={`flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed rounded-xl cursor-pointer transition-colors
                            ${isDragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                        >
                          <ImageIcon size={24} className="text-slate-400 mb-2" />
                          <p className="text-xs font-avenir text-slate-700">
                            {slots.length === 2 ? `Photo ${idx + 1}` : 'Drop or click'}
                          </p>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveSlot(idx)}
                          className={`flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed rounded-xl cursor-pointer transition-colors
                            ${activeSlot === idx ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                        >
                          <Images size={24} className="text-slate-400 mb-2" />
                          <p className="text-xs font-avenir text-slate-700">
                            {slots.length === 2 ? `Pick photo ${idx + 1} below` : 'Pick a photo below'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Library grid — shown when the "From your library" tab is active */}
              {sourceTab === 'library' && (
                <div className="mb-4 border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto">
                  {libraryLoading && (
                    <p className="text-sm font-avenir text-slate-500 text-center py-6">Loading your photos…</p>
                  )}
                  {libraryError && (
                    <p className="text-sm font-avenir text-red-700 text-center py-6">{libraryError}</p>
                  )}
                  {!libraryLoading && !libraryError && libraryPhotos?.length === 0 && (
                    <p className="text-sm font-avenir text-slate-400 italic text-center py-6">
                      No photos in your library yet. Upload some from the Photo Library panel, or use "Upload new" here.
                    </p>
                  )}
                  {!libraryLoading && libraryPhotos && libraryPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {libraryPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => assignLibraryPhoto(activeSlot, photo)}
                          className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                          title={photo.caption ?? ''}
                        >
                          <img src={photo.image_url} alt={photo.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {slots.some((s) => s !== null) && (
                <label className="block mb-3">
                  <span className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-1.5">
                    {slots.length === 2 ? 'Shared caption' : 'Caption'}
                  </span>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={slots.length === 2 ? 'A caption that describes both photos' : 'Optional caption (shown below the image)'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-lora text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
                  />
                </label>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-700 font-avenir">{error}</p>
              )}

              <div className="flex justify-between items-center mt-5">
                <button
                  onClick={() => { setLayout(null); setSlots([null]); }}
                  disabled={busy || !layout}
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
                    disabled={!allSlotsReady || busy}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-full text-sm font-avenir hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {busy ? 'Working…' : 'Insert'}
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
