import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Plus, X, ArrowLeft, ArrowRight, Loader2, ImageIcon } from 'lucide-react';
import { supabase, GalleryItem } from '../../lib/supabase';
import { useImageUpload } from '../../hooks/useImageUpload';

interface GalleryEditorProps {
  /** Page being edited (gallery items have page_id === pageId) */
  pageId: number;
  chapterId: number;
  /** Book slug, used for upload folder */
  bookSlug: string;
  /** Initial items (page-attached gallery rows for this page) */
  initialItems: GalleryItem[];
  /** Notify parent of changes so it can reflect aggregate save status / dirty state */
  onChanged?: () => void;
}

/**
 * Manages the page-level gallery (rows in `gallery` with page_id = this page).
 *
 * - Add: upload + insert row
 * - Remove: delete row (storage object kept — same reasoning as for image_url)
 * - Reorder: shift left/right (writes new sort_order to all affected rows)
 * - Caption: inline edit, debounced save
 */
export default function GalleryEditor({
  pageId, chapterId, bookSlug, initialItems, onChanged,
}: GalleryEditorProps) {
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [savingCaption, setSavingCaption] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error, clearError } = useImageUpload({ folder: bookSlug });

  // Sync if page changes
  useEffect(() => {
    setItems(initialItems);
  }, [pageId, initialItems]);

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('gallery')
      .select('*')
      .eq('page_id', pageId)
      .order('sort_order', { ascending: true });
    if (!err && data) {
      setItems(data);
      onChanged?.();
    }
  }, [pageId, onChanged]);

  // ── Add ───────────────────────────────────────────────────────
  const handleAddClick = () => fileInputRef.current?.click();

  const handleFile = async (file: File) => {
    const uploaded = await upload(file);
    if (!uploaded) return;

    const nextOrder = items.length > 0
      ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1
      : 0;

    const { error: insertErr } = await supabase.from('gallery').insert({
      image_url: uploaded.publicUrl,
      chapter_id: chapterId,
      page_id: pageId,
      sort_order: nextOrder,
    });
    if (insertErr) {
      console.error('Failed to insert gallery row:', insertErr);
      return;
    }
    await refresh();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  // ── Remove ────────────────────────────────────────────────────
  const handleRemove = async (id: number) => {
    if (!confirm('Remove this photo from the gallery? The image file itself will stay in storage.')) return;
    const { error: delErr } = await supabase.from('gallery').delete().eq('id', id);
    if (delErr) {
      console.error('Failed to delete gallery row:', delErr);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    onChanged?.();
  };

  // ── Reorder ───────────────────────────────────────────────────
  const move = async (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    // Reassign sort_order
    const renumbered = next.map((it, i) => ({ ...it, sort_order: i }));
    setItems(renumbered);
    // Persist the two affected rows
    await Promise.all([
      supabase.from('gallery').update({ sort_order: renumbered[idx].sort_order }).eq('id', renumbered[idx].id),
      supabase.from('gallery').update({ sort_order: renumbered[newIdx].sort_order }).eq('id', renumbered[newIdx].id),
    ]);
    onChanged?.();
  };

  // ── Caption edit ──────────────────────────────────────────────
  const updateCaption = (id: number, caption: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, image_caption: caption } : i)));
  };

  const commitCaption = async (id: number, caption: string) => {
    setSavingCaption(id);
    await supabase.from('gallery').update({ image_caption: caption }).eq('id', id);
    setSavingCaption(null);
    onChanged?.();
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-avenir uppercase tracking-wider text-slate-500">
          Gallery ({items.length})
        </h3>
        <button
          type="button"
          onClick={handleAddClick}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-avenir
            bg-slate-800 text-white rounded-full hover:bg-slate-900
            disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="flex-1 text-sm text-red-700 font-avenir">{error}</p>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <button
          type="button"
          onClick={handleAddClick}
          disabled={uploading}
          className="w-full py-8 border-2 border-dashed border-slate-300 rounded-lg
            hover:border-slate-400 hover:bg-slate-50 transition-colors
            flex flex-col items-center gap-2 disabled:opacity-50"
        >
          <ImageIcon size={24} className="text-slate-400" />
          <span className="text-sm font-avenir text-slate-600">
            No gallery photos yet. Click to add one.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((item, idx) => (
            <div key={item.id} className="relative group">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                <img
                  src={item.image_url}
                  alt={item.image_caption ?? ''}
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-between p-1.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 bg-white rounded-full shadow disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move left"
                  >
                    <ArrowLeft size={14} className="text-slate-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 bg-white rounded-full shadow text-red-600 hover:bg-red-50"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, +1)}
                    disabled={idx === items.length - 1}
                    className="p-1.5 bg-white rounded-full shadow disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move right"
                  >
                    <ArrowRight size={14} className="text-slate-700" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={item.image_caption ?? ''}
                onChange={(e) => updateCaption(item.id, e.target.value)}
                onBlur={(e) => commitCaption(item.id, e.target.value)}
                placeholder="Caption"
                className="w-full mt-1.5 px-2 py-1 text-xs font-lora italic text-slate-600 text-center
                  bg-transparent border-0 border-b border-transparent
                  hover:border-slate-200 focus:border-slate-400 focus:outline-none
                  placeholder:text-slate-400 placeholder:not-italic"
              />
              {savingCaption === item.id && (
                <p className="text-[10px] text-slate-400 text-center">Saving…</p>
              )}
            </div>
          ))}
        </div>
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
