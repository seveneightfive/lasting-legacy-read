import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Search, Images } from 'lucide-react';
import { supabase, Book, Chapter, Page, GalleryItem } from '../../lib/supabase';
import { useImageUpload } from '../../hooks/useImageUpload';

interface PhotoLibraryProps {
  open: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
}

interface LibraryImage {
  id: number;
  source: 'page' | 'gallery';
  url: string;
  caption: string;
  chapterId: number;
  chapterName: string;
  pageId: number | null;
  pageLabel: string;
}

export default function PhotoLibrary({ open, onClose, book, chapters }: PhotoLibraryProps) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterChapter, setFilterChapter] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingImage, setEditingImage] = useState<LibraryImage | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editPageId, setEditPageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);

  const { upload, uploading } = useImageUpload({ folder: book.slug });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const chapterMap = new Map(chapters.map((c) => [c.id, c.title || `Chapter ${c.number}`]));

      const [{ data: pagesData }, { data: galleryData }] = await Promise.all([
        supabase.from('pages').select('*').in('chapter_id', chapters.map((c) => c.id))
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('gallery').select('*').in('chapter_id', chapters.map((c) => c.id))
          .order('sort_order', { ascending: true }),
      ]);

      setPages(pagesData ?? []);

      const all: LibraryImage[] = [];

      (pagesData ?? []).filter((p) => p.image_url).forEach((p) => {
        all.push({
          id: p.id,
          source: 'page',
          url: p.image_url!,
          caption: p.image_caption ?? '',
          chapterId: p.chapter_id,
          chapterName: chapterMap.get(p.chapter_id) ?? 'Unknown',
          pageId: p.id,
          pageLabel: p.subtitle ?? `Page ${p.id}`,
        });
      });

      (galleryData ?? []).filter((g) => g.image_url).forEach((g) => {
        const pg = (pagesData ?? []).find((p) => p.id === g.page_id);
        all.push({
          id: g.id,
          source: 'gallery',
          url: g.image_url,
          caption: g.image_caption ?? g.image_title ?? '',
          chapterId: g.chapter_id,
          chapterName: chapterMap.get(g.chapter_id) ?? 'Unknown',
          pageId: g.page_id ?? null,
          pageLabel: pg?.subtitle ?? (g.page_id ? `Page ${g.page_id}` : 'Chapter gallery'),
        });
      });

      setImages(all);
    } finally {
      setLoading(false);
    }
  }, [book.id, chapters]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = images.filter((img) => {
    if (filterChapter && String(img.chapterId) !== filterChapter) return false;
    if (filterSource && img.source !== filterSource) return false;
    if (searchQuery && !img.caption.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !img.pageLabel.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: images.length,
    page: images.filter((i) => i.source === 'page').length,
    gallery: images.filter((i) => i.source === 'gallery').length,
    captioned: images.filter((i) => i.caption.trim()).length,
  };

  const openEdit = (img: LibraryImage) => {
    setEditingImage(img);
    setEditCaption(img.caption);
    setEditChapterId(String(img.chapterId));
    setEditPageId(img.pageId ? String(img.pageId) : '');
  };

  const closeEdit = () => {
    setEditingImage(null);
    setEditCaption('');
    setEditChapterId('');
    setEditPageId('');
  };

  const saveEdit = async () => {
    if (!editingImage) return;
    setSaving(true);
    try {
      const chapterId = parseInt(editChapterId) || editingImage.chapterId;
      const pageId = editPageId ? parseInt(editPageId) : null;

      if (editingImage.source === 'gallery') {
        await supabase.from('gallery').update({
          image_caption: editCaption || null,
          chapter_id: chapterId,
          page_id: pageId,
        }).eq('id', editingImage.id);
      } else {
        await supabase.from('pages').update({
          image_caption: editCaption || null,
          chapter_id: chapterId,
        }).eq('id', editingImage.id);
      }

      setImages((prev) => prev.map((img) =>
        img.id === editingImage.id && img.source === editingImage.source
          ? { ...img, caption: editCaption, chapterId, pageId,
              chapterName: chapters.find((c) => c.id === chapterId)?.title ?? img.chapterName }
          : img
      ));
      closeEdit();
    } finally {
      setSaving(false);
    }
  };

  const downloadImage = (url: string, id: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-${id}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pagesForChapter = pages.filter(
    (p) => p.chapter_id === parseInt(editChapterId || String(editingImage?.chapterId ?? 0))
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 z-30"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-4xl bg-white shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Images size={18} className="text-slate-500" />
                <h2 className="font-avenir text-slate-800 text-sm uppercase tracking-wider">
                  Photo Library
                </h2>
              </div>
              <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Stats */}
            <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-4 gap-3 shrink-0">
              {[
                { label: 'Total photos', value: stats.total },
                { label: 'Page images', value: stats.page },
                { label: 'Gallery photos', value: stats.gallery },
                { label: 'With captions', value: stats.captioned },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-800 font-avenir">{value}</div>
                  <div className="text-xs text-slate-500 font-avenir mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-slate-100 flex gap-3 items-center shrink-0 flex-wrap">
              <select
                value={filterChapter}
                onChange={(e) => setFilterChapter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-avenir text-slate-700 bg-white focus:outline-none focus:border-slate-400"
              >
                <option value="">All chapters</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.title || `Chapter ${c.number}`}</option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-avenir text-slate-700 bg-white focus:outline-none focus:border-slate-400"
              >
                <option value="">All sources</option>
                <option value="page">Page images</option>
                <option value="gallery">Gallery photos</option>
              </select>
              <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search captions…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 text-sm font-avenir text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <span className="text-xs font-avenir text-slate-400 ml-auto shrink-0">
                {filtered.length} photo{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-slate-500 font-avenir text-sm">Loading photos…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <Images size={32} className="text-slate-300" />
                  <p className="text-slate-400 font-avenir text-sm italic">No photos found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filtered.map((img) => (
                    <div key={`${img.source}-${img.id}`}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative aspect-[4/3] bg-slate-100 cursor-pointer"
                        onClick={() => openEdit(img)}>
                        <img
                          src={img.url}
                          alt={img.caption}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className={`absolute bottom-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded
                          ${img.source === 'gallery' ? 'bg-amber-500/90 text-white' : 'bg-slate-700/80 text-white'}`}>
                          {img.source === 'gallery' ? 'gallery' : 'page'}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[11px] font-avenir text-slate-500 truncate">{img.chapterName}</p>
                        <p className="text-xs font-lora italic text-slate-600 truncate mt-0.5">
                          {img.caption || <span className="text-slate-300 not-italic">No caption</span>}
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => downloadImage(img.url, img.id)}
                            className="p-1 rounded border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
                            title="Download"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => openEdit(img)}
                            className="flex-1 text-[11px] font-avenir text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors py-1"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit modal */}
            <AnimatePresence>
              {editingImage && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeEdit}
                    className="absolute inset-0 bg-black/40 z-10"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 bg-white rounded-xl shadow-2xl max-w-md mx-auto overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-avenir text-slate-800 text-sm font-semibold">Edit photo</h3>
                      <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <img
                        src={editingImage.url}
                        alt=""
                        className="w-full max-h-48 object-contain rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <div>
                        <label className="block text-xs font-avenir font-bold text-slate-600 uppercase tracking-wider mb-1.5">Caption</label>
                        <textarea
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          placeholder="Add a caption…"
                          rows={3}
                          className="w-full px-3 py-2 text-sm font-avenir text-slate-700 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-avenir font-bold text-slate-600 uppercase tracking-wider mb-1.5">Move to chapter</label>
                        <select
                          value={editChapterId}
                          onChange={(e) => { setEditChapterId(e.target.value); setEditPageId(''); }}
                          className="w-full px-3 py-2 text-sm font-avenir text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white"
                        >
                          {chapters.map((c) => (
                            <option key={c.id} value={c.id}>{c.title || `Chapter ${c.number}`}</option>
                          ))}
                        </select>
                      </div>
                      {editingImage.source === 'gallery' && (
                        <div>
                          <label className="block text-xs font-avenir font-bold text-slate-600 uppercase tracking-wider mb-1.5">Assign to page (optional)</label>
                          <select
                            value={editPageId}
                            onChange={(e) => setEditPageId(e.target.value)}
                            className="w-full px-3 py-2 text-sm font-avenir text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white"
                          >
                            <option value="">Chapter gallery — not tied to a page</option>
                            {pagesForChapter.map((p) => (
                              <option key={p.id} value={p.id}>{p.subtitle || `Page ${p.id}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4 border-t border-slate-200 flex justify-between items-center">
                      <button
                        onClick={() => downloadImage(editingImage.url, editingImage.id)}
                        className="flex items-center gap-1.5 text-xs font-avenir text-slate-500 hover:text-slate-700"
                      >
                        <Download size={12} />
                        Download
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={closeEdit}
                          className="px-4 py-2 text-sm font-avenir text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-avenir text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
