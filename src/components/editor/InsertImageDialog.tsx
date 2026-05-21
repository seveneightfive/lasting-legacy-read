import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, ImageIcon, AlignLeft, LayoutGrid } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

interface InsertImageDialogProps {
  bookSlug: string;
  allowGallery: boolean;
  onCancel: () => void;
  onInsertInline: (url: string, alt?: string) => void;
  onAddToGallery: (url: string, caption?: string) => Promise<void>;
}

type Destination = 'inline' | 'gallery';

/**
 * Two-step modal:
 *   Step 1: pick destination (inline in prose vs page gallery)
 *   Step 2: upload + optional caption/alt
 *
 * If allowGallery is false (e.g. user is in the dedication editor), step 1 is skipped.
 */
export default function InsertImageDialog({
  bookSlug, allowGallery, onCancel, onInsertInline, onAddToGallery,
}: InsertImageDialogProps) {
  const [destination, setDestination] = useState<Destination | null>(
    allowGallery ? null : 'inline'
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error, clearError } = useImageUpload({ folder: bookSlug });

  const pickFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    clearError();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
    e.target.value = '';
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }, []);

  const handleInsert = async () => {
    if (!file || !destination) return;
    setSubmitting(true);
    const result = await upload(file);
    if (!result) {
      setSubmitting(false);
      return;
    }
    if (destination === 'inline') {
      onInsertInline(result.publicUrl, caption);
    } else {
      await onAddToGallery(result.publicUrl, caption);
    }
    setSubmitting(false);
  };

  const busy = uploading || submitting;

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
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative"
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
            {destination
              ? destination === 'inline'
                ? 'The image will appear inline in the story text where your cursor is.'
                : 'The image will be added to this page\u2019s gallery (shown below the story).'
              : 'Where should this image go?'}
          </p>

          {/* Step 1: destination */}
          {!destination && allowGallery && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setDestination('inline')}
                className="flex flex-col items-center text-center p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                  <AlignLeft size={20} className="text-amber-700" />
                </div>
                <span className="font-avenir text-slate-800 mb-1">Inline in story</span>
                <span className="text-xs text-slate-500 font-avenir">Mixed with the prose</span>
              </button>
              <button
                onClick={() => setDestination('gallery')}
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

          {/* Step 2: pick + caption */}
          {destination && (
            <div>
              {!previewUrl ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                    ${dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                >
                  <ImageIcon size={28} className="text-slate-400 mb-2" />
                  <p className="text-sm font-avenir text-slate-700 mb-1">
                    Drop a photo or click to choose
                  </p>
                  <p className="text-xs text-slate-400 font-avenir">
                    JPG, PNG, WebP or GIF — up to 10 MB
                  </p>
                </div>
              ) : (
                <div>
                  <div className="relative rounded-xl overflow-hidden bg-slate-100 mb-3">
                    <img src={previewUrl} alt="" className="w-full max-h-80 object-contain" />
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreviewUrl(null); setCaption(''); }}
                      className="absolute top-2 right-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-xs font-avenir text-slate-700 hover:bg-white shadow"
                    >
                      Choose a different photo
                    </button>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-1.5">
                      {destination === 'inline' ? 'Alt text (for accessibility)' : 'Caption'}
                    </span>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder={destination === 'inline' ? 'Describe the image' : 'Optional caption'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-lora text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
                    />
                  </label>
                </div>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-700 font-avenir">{error}</p>
              )}

              <div className="flex justify-between items-center mt-5">
                {allowGallery ? (
                  <button
                    onClick={() => setDestination(null)}
                    disabled={busy}
                    className="text-sm font-avenir text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    ← Back
                  </button>
                ) : <div />}
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
                    disabled={!file || busy}
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
