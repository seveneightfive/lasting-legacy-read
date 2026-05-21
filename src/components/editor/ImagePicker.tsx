import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, RefreshCw, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

interface ImagePickerProps {
  /** Current image URL. Null/empty = no image set. */
  value: string | null | undefined;
  /** Called with the new URL after upload, or null when removed. */
  onChange: (url: string | null) => void;
  /** Folder under the bucket. Typically the book slug. */
  folder: string;
  /** Optional caption shown below the image. If onCaptionChange is provided, it becomes editable. */
  caption?: string;
  onCaptionChange?: (caption: string) => void;
  /** Visual variant — controls the empty-state framing. */
  variant?: 'hero' | 'cover' | 'square';
  /** Override the default placeholder text. */
  placeholder?: string;
}

/**
 * The left-panel image experience for the editor.
 *
 * - Empty state: a big drop zone ("Drop a photo or click to upload")
 * - With image: full-bleed display + hover overlay with Replace / Remove
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
}: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
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

  // ── Empty state ─────────────────────────────────────────────────
  if (!value) {
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
              <p className="text-slate-400 font-avenir text-xs">
                JPG, PNG, WebP or GIF — up to 10 MB
              </p>
            </>
          )}
        </div>

        {error && (
          <ErrorBanner message={error} onDismiss={clearError} />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
        />
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
            onClick={() => onChange(null)}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="hidden"
      />
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
