import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, RefreshCw, Loader2, AlertCircle, ImageIcon, Images } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { supabase } from '../../lib/supabase';

interface LibraryPhoto {
  id: number;
  image_url: string;
  caption: string | null;
}

interface ImagePickerProps {
  /** Current image URL. Null/empty = no image set. */
  value: string | null | undefined;
  /** Called with the new URL after upload, or null when removed. */
  onChange: (url: string | null) => void;
  /** Folder under the bucket. Typically the book slug — also used as the
   *  book_slug key when reading/writing the shared photo_library table. */
  folder: string;
  /** Optional caption shown below the image. If onCaptionChange is provided, it becomes editable. */
  caption?: string;
  onCaptionChange?: (caption: string) => void;
  /** Visual variant — controls the empty-state framing. */
  variant?: 'hero' | 'cover' | 'square';
  /** Override the default placeholder text. */
  placeholder?: string;
  /**
   * A photo that's already in use elsewhere for this same page/chapter
   * (e.g. its first gallery photo) that readers will actually see here
   * until a dedicated photo is set. Shown as a preview with a one-click
   * "use this" action — never silently written to `value`.
   */
  fallbackUrl?: string | null;
}

/**
 * The left-panel image experience for the editor.
 *
 * - Empty state: a big drop zone, OR — if a fallback photo exists (e.g. the
 *   page's first gallery item, which is what readers see when there's no
 *   dedicated page photo) — a preview of that photo with a note + a button
 *   to promote it to the dedicated slot.
 * - With image: full-bleed display + hover overlay with Replace / Library / Remove
 * - "Choose from library" lets you reuse a photo already uploaded to this
 *   book instead of uploading a duplicate.
 * - Removing a photo archives it to the book's photo library first, so it
 *   isn't lost — just freed up to be picked again later.
 * - Drag-and-drop anywhere on the component
 * - Validates size + type via useImageUpload
 * - Optional editable caption below
 */
export default function ImagePicker({
  value,
  onChange,
  folder,
  caption,
  onCaptionChange,
  variant = 'hero',
  placeholder,
  fallbackUrl,
}: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { upload, uploading, error, clearError } = useImageUpload({ folder });

  const handleFile = useCallback(async (file: File) => {
    const result = await upload(file);
    if (result) onChange(result.publicUrl);
  }, [upload, onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so picking the same file again still fires onChange
    e.target.value = '';
  };

  const openPicker = () => fileInputRef.current?.click();

  // Remove the current photo — but archive it to the book's photo library
  // first (if it isn't already there) so it stays pickable elsewhere
  // instead of just disappearing.
  const handleRemove = useCallback(async () => {
    if (value) {
      try {
        const { data: existing } = await supabase
          .from('photo_library')
          .select('id')
          .eq('book_slug', folder)
          .eq('image_url', value)
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from('photo_library').insert({
            book_slug: folder,
            image_url: value,
            caption: caption || null,
          });
        }
      } catch (err) {
        // Non-fatal — worst case the photo just isn't archived to the library.
        console.error('[ImagePicker] could not archive removed photo to library:', err);
      }
    }
    onChange(null);
  }, [value, folder, caption, onChange]);

  const inputEl = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onChange={onFileChange}
      className="hidden"
    />
  );

  const libraryModal = libraryOpen && (
    <LibraryPickerModal
      bookSlug={folder}
      onCancel={() => setLibraryOpen(false)}
      onPick={(url) => { onChange(url); setLibraryOpen(false); }}
    />
  );

  // ── Empty state ─────────────────────────────────────────────────
  if (!value) {
    // A fallback photo exists (e.g. first gallery item) — show what readers
    // actually see here today, instead of a misleading "no photo" state.
    if (fallbackUrl) {
      return (
        <div className="w-full h-full flex flex-col">
          <div className="relative rounded-xl overflow-hidden flex-1 min-h-[220px] bg-slate-50">
            <img src={fallbackUrl} alt="" className="w-full h-full object-contain bg-slate-50" />
          </div>
          <div className="mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-avenir text-amber-800 leading-snug">
              No dedicated photo is set for this page — readers currently see this gallery photo here instead.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => onChange(fallbackUrl)}
                className="px-3 py-1.5 text-xs font-avenir font-semibold text-white bg-slate-800 rounded-full hover:bg-slate-900 transition-colors"
              >
                Use this as the page photo
              </button>
              <button
                type="button"
                onClick={openPicker}
                disabled={uploading}
                className="px-3 py-1.5 text-xs font-avenir text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload a different photo'}
              </button>
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-avenir text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-100 transition-colors"
              >
                <Images size={12} />
                Choose from library
              </button>
            </div>
          </div>
          {error && <ErrorBanner message={error} onDismiss={clearError} />}
          {inputEl}
          {libraryModal}
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col">
        <div
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
          className={`flex-1 flex flex-col items-center justify-center
            border-2 border-dashed rounded-xl cursor-pointer
            transition-colors p-8 min-h-[300px]
            ${dragOver
              ? 'border-amber-400 bg-amber-50'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
            }`}
        >
          {uploading ? (
            <>
              <Loader2 size={36} className="text-slate-400 animate-spin mb-3" />
              <p className="text-slate-600 font-avenir">Uploading…</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
                <ImageIcon size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-700 font-avenir text-base mb-1">
                {placeholder ?? 'Drop a photo here or click to upload'}
              </p>
              <p className="text-slate-400 font-avenir text-xs mb-3">
                JPG, PNG, WebP or GIF — up to 10 MB
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLibraryOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-avenir text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-100 transition-colors"
              >
                <Images size={13} />
                Choose from library
              </button>
            </>
          )}
        </div>

        {error && (
          <ErrorBanner message={error} onDismiss={clearError} />
        )}

        {inputEl}
        {libraryModal}
      </div>
    );
  }

  // ── With image ──────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative group rounded-xl overflow-hidden flex-1 min-h-[300px]
          ${dragOver ? 'ring-4 ring-amber-300' : ''}`}
      >
        <img
          src={value}
          alt=""
          className={`w-full h-full ${
            variant === 'cover' ? 'object-contain bg-slate-100' :
            variant === 'square' ? 'object-cover' :
            'object-contain bg-slate-50'
          }`}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-full font-avenir text-sm hover:bg-slate-100 transition-colors shadow-lg disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-full font-avenir text-sm hover:bg-slate-100 transition-colors shadow-lg disabled:opacity-50"
          >
            <Images size={14} />
            Library
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 rounded-full font-avenir text-sm hover:bg-red-50 transition-colors shadow-lg disabled:opacity-50"
          >
            <X size={14} />
            Remove
          </button>
        </div>

        {/* Drop hint while dragging */}
        {dragOver && (
          <div className="absolute inset-0 bg-amber-100/80 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg">
              <Upload size={16} className="text-amber-700" />
              <span className="font-avenir text-amber-800">Drop to replace</span>
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {(caption !== undefined || onCaptionChange) && (
        <div className="mt-3">
          {onCaptionChange ? (
            <input
              type="text"
              value={caption ?? ''}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full px-3 py-2 text-sm font-lora italic text-slate-700 text-center
                bg-transparent border-0 border-b border-transparent
                hover:border-slate-200 focus:border-slate-400 focus:outline-none
                placeholder:text-slate-400 placeholder:not-italic transition-colors"
            />
          ) : caption ? (
            <p className="text-sm text-slate-600 italic font-lora text-center">{caption}</p>
          ) : null}
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {inputEl}
      {libraryModal}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
      <p className="flex-1 text-sm text-red-700 font-avenir">{message}</p>
      <button
        onClick={onDismiss}
        className="text-red-500 hover:text-red-700"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Small modal for picking an existing photo out of this book's photo
 * library (the `photo_library` table) — the same idea as the "From your
 * library" tab in InsertImageDialog, but for the single hero/chapter/page
 * image slot that ImagePicker controls.
 */
function LibraryPickerModal({
  bookSlug,
  onCancel,
  onPick,
}: {
  bookSlug: string;
  onCancel: () => void;
  onPick: (url: string) => void;
}) {
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('photo_library')
        .select('id, image_url, caption')
        .eq('book_slug', bookSlug)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { setLoadError(error.message || 'Could not load your photo library.'); return; }
      setPhotos(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [bookSlug]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative max-h-[85vh] overflow-y-auto"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-avenir text-slate-800 mb-1 heading-tracking">Choose from library</h2>
        <p className="text-sm text-slate-500 font-avenir mb-4">
          Pick a photo you've already uploaded to this book.
        </p>

        {photos === null && !loadError && (
          <p className="text-sm font-avenir text-slate-500 text-center py-8">Loading your photos…</p>
        )}
        {loadError && (
          <p className="text-sm font-avenir text-red-700 text-center py-8">{loadError}</p>
        )}
        {photos && photos.length === 0 && (
          <p className="text-sm font-avenir text-slate-400 italic text-center py-8">
            No unused photos in your library yet. Upload some from the Photo Library panel.
          </p>
        )}
        {photos && photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPick(photo.image_url)}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                title={photo.caption ?? ''}
              >
                <img src={photo.image_url} alt={photo.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
