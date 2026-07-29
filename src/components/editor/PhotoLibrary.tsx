import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Search, Images, Crop, Upload, Loader2, Trash2 } from 'lucide-react';
import { supabase, Book, Chapter, Page, GalleryItem } from '../../lib/supabase';
import { useImageUpload } from '../../hooks/useImageUpload';
import CropModal from './CropModal';

interface PhotoLibraryProps {
  open: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
}

type ImageSource = 'page' | 'gallery' | 'content' | 'book' | 'chapter' | 'library';

interface LibraryImage {
  id: number;
  source: ImageSource;
  url: string;
  caption: string;
  chapterId: number;
  chapterName: string;
  pageId: number | null;
  pageLabel: string;
}

// Extract <img> images (optionally wrapped in <figure>) from rich-text HTML content
function extractContentImages(
  html: string,
  pageId: number,
  chapterId: number,
  chapterName: string,
  pageLabel: string
): LibraryImage[] {
  const results: LibraryImage[] = [];
  if (typeof DOMParser === 'undefined') return results;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img');

  imgs.forEach((img, idx) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) return;

    const figure = img.closest('figure');
    const figcaption = figure?.querySelector('figcaption');
    const caption = figcaption?.textContent?.trim() ?? '';

    results.push({
      id: -(pageId * 1000 + idx),
      source: 'content',
      url: src,
      caption,
      chapterId,
      chapterName,
      pageId,
      pageLabel,
    });
  });

  return results;
}

// Reserved synthetic ids for the single book-level images so they don't collide
// with real row ids from pages/gallery.
const BOOK_COVER_ID = -1;
const BOOK_INTRO_ID = -2;
const CHAPTER_HEADER_ID_OFFSET = -1000000; // chapterId gets subtracted from this

interface RawLibraryRow {
  id: number;
  image_url: string;
  caption: string | null;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);

  // Bulk "upload to library" state
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const { upload } = useImageUpload({ folder: book.slug });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const chapterMap = new Map(chapters.map((c) => [c.id, c.title || `Chapter ${c.number}`]));

      const [{ data: pagesData }, { data: galleryData }, { data: libraryData }] = await Promise.all([
        supabase.from('pages').select('*').in('chapter_id', chapters.map((c) => c.id))
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('gallery').select('*').in('chapter_id', chapters.map((c) => c.id))
          .order('sort_order', { ascending: true }),
        supabase.from('photo_library').select('id, image_url, caption')
          .eq('book_slug', book.slug)
          .order('created_at', { ascending: false }),
      ]);

      setPages(pagesData ?? []);

      const all: LibraryImage[] = [];

      // 0a. Book cover photo
      if (book.image_url) {
        all.push({
          id: BOOK_COVER_ID,
          source: 'book',
          url: book.image_url,
          caption: '',
          chapterId: 0,
          chapterName: 'Book',
          pageId: null,
          pageLabel: 'Cover photo',
        });
      }

      // 0b. Book intro photo
      if (book.intro_image_url) {
        all.push({
          id: BOOK_INTRO_ID,
          source: 'book',
          url: book.intro_image_url,
          caption: book.intro_image_caption ?? '',
          chapterId: 0,
          chapterName: 'Book',
          pageId: null,
          pageLabel: 'Intro photo',
        });
      }

      // 0c. Chapter header images
      chapters.forEach((c) => {
        if (c.image_url) {
          all.push({
            id: CHAPTER_HEADER_ID_OFFSET - c.id,
            source: 'chapter',
            url: c.image_url,
            caption: '',
            chapterId: c.id,
            chapterName: chapterMap.get(c.id) ?? 'Unknown',
            pageId: null,
            pageLabel: 'Chapter header',
          });
        }
      });

      // 1. page.image_url
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

      // 2. gallery table rows
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

      // 3. <figure>/<img> images embedded inside page.content HTML
      (pagesData ?? [])
        .filter((p) => p.content?.includes('<img'))
        .forEach((p) => {
          const embedded = extractContentImages(
            p.content!,
            p.id,
            p.chapter_id,
            chapterMap.get(p.chapter_id) ?? 'Unknown',
            p.subtitle ?? `Page ${p.id}`
          );
          all.push(...embedded);
        });

      // 4. Unassigned library uploads — not tied to any chapter/page yet.
      //    Lives in its own table (`photo_library`) so it never touches
      //    Glide/Whalesync-synced columns.
      ((libraryData ?? []) as RawLibraryRow[]).forEach((row) => {
        all.push({
          id: row.id,
          source: 'library',
          url: row.image_url,
          caption: row.caption ?? '',
          chapterId: 0,
          chapterName: 'Library',
          pageId: null,
          pageLabel: 'Not used yet',
        });
      });

      setImages(all);
    } finally {
      setLoading(false);
    }
  }, [book.id, book.slug, book.image_url, book.intro_image_url, book.intro_image_caption, chapters]);

  const [cropping, setCropping] = useState(false);

  const handleCropSave = async (blob: Blob) => {
    if (!editingImage || editingImage.source === 'content') return;
    const file = new File([blob], `cropped-${Math.abs(editingImage.id)}.jpg`, { type: 'image/jpeg' });
    const uploaded = await upload(file);
    if (!uploaded) return;

    let error: { message?: string } | null = null;

    if (editingImage.source === 'gallery') {
      ({ error } = await supabase.from('gallery').update({ image_url: uploaded.publicUrl }).eq('id', editingImage.id));
    } else if (editingImage.source === 'page') {
      ({ error } = await supabase.from('pages').update({ image_url: uploaded.publicUrl }).eq('id', editingImage.id));
    } else if (editingImage.source === 'book') {
      const isIntro = editingImage.id === BOOK_INTRO_ID;
      ({ error } = await supabase
        .from('books')
        .update(isIntro ? { intro_image_url: uploaded.publicUrl } : { image_url: uploaded.publicUrl })
        .eq('id', book.id));
    } else if (editingImage.source === 'chapter') {
      ({ error } = await supabase
        .from('chapters')
        .update({ image_url: uploaded.publicUrl })
        .eq('id', editingImage.chapterId));
    } else if (editingImage.source === 'library') {
      ({ error } = await supabase
        .from('photo_library')
        .update({ image_url: uploaded.publicUrl })
        .eq('id', editingImage.id));
    }

    if (error) {
      setSaveError(error.message || 'Could not save the cropped photo.');
      return;
    }

    setImages((prev) => prev.map((img) =>
      img.id === editingImage.id && img.source === editingImage.source
        ? { ...img, url: uploaded.publicUrl }
        : img
    ));
    setEditingImage((prev) => (prev ? { ...prev, url: uploaded.publicUrl } : prev));
    setCropping(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // ── Bulk upload into the library ────────────────────────────
  const handleBulkFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBulkUploading(true);
    setBulkError(null);
    setBulkProgress({ done: 0, total: files.length });

    let successCount = 0;
    for (const file of files) {
      const result = await upload(file);
      if (result) {
        const { error } = await supabase.from('photo_library').insert({
          book_slug: book.slug,
          image_url: result.publicUrl,
        });
        if (!error) successCount += 1;
      }
      setBulkProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
    }

    setBulkUploading(false);
    setBulkProgress(null);
    if (successCount < files.length) {
      setBulkError(`${successCount} of ${files.length} photos uploaded. Some may have failed — try those again.`);
    }
    await load();
  };

  const onBulkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleBulkFiles(e.target.files);
    e.target.value = '';
  };

  const deleteLibraryPhoto = async (img: LibraryImage) => {
    if (img.source !== 'library') return;
    const ok = window.confirm('Remove this photo from your library? It will no longer be available to pick from — this doesn\u2019t affect any place it\u2019s already been used.');
    if (!ok) return;
    const { error } = await supabase.from('photo_library').delete().eq('id', img.id);
    if (error) { window.alert('Could not remove this photo. Please try again.'); return; }
    setImages((prev) => prev.filter((i) => !(i.source === 'library' && i.id === img.id)));
    if (editingImage?.source === 'library' && editingImage.id === img.id) closeEdit();
  };

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
    content: images.filter((i) => i.source === 'content').length,
    bookAndChapter: images.filter((i) => i.source === 'book' || i.source === 'chapter').length,
    library: images.filter((i) => i.source === 'library').length,
    captioned: images.filter((i) => i.caption.trim()).length,
  };

  const openEdit = (img: LibraryImage) => {
    setEditingImage(img);
    setEditCaption(img.caption);
    setEditChapterId(String(img.chapterId));
    setEditPageId(img.pageId ? String(img.pageId) : '');
    setSaveError(null);
    setPromoteError(null);
  };

  const closeEdit = () => {
    setEditingImage(null);
    setEditCaption('');
    setEditChapterId('');
    setEditPageId('');
    setSaveError(null);
    setPromoteError(null);
    setCropping(false);
  };

  const saveEdit = async () => {
    if (!editingImage) return;

    // Content-embedded images can't be edited here (they live inside HTML)
    if (editingImage.source === 'content') {
      setSaveError('This image is embedded in page content. Edit its caption in the page editor.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Book cover / intro photo — no chapter/page reassignment applies.
      if (editingImage.source === 'book') {
        const isIntro = editingImage.id === BOOK_INTRO_ID;
        if (isIntro) {
          const { error } = await supabase
            .from('books')
            .update({ intro_image_caption: editCaption || null })
            .eq('id', book.id);
          if (error) {
            setSaveError(error.message || 'Something went wrong saving this photo.');
            return;
          }
        }
        setImages((prev) => prev.map((img) =>
          img.id === editingImage.id && img.source === 'book'
            ? { ...img, caption: editCaption }
            : img
        ));
        closeEdit();
        return;
      }

      // Chapter header image — no caption field in the schema, nothing to save
      // beyond a crop (handled separately in handleCropSave).
      if (editingImage.source === 'chapter') {
        closeEdit();
        return;
      }

      // Library photo — just update its caption, no chapter/page concept.
      if (editingImage.source === 'library') {
        const { error } = await supabase
          .from('photo_library')
          .update({ caption: editCaption || null })
          .eq('id', editingImage.id);
        if (error) {
          setSaveError(error.message || 'Something went wrong saving this photo.');
          return;
        }
        setImages((prev) => prev.map((img) =>
          img.id === editingImage.id && img.source === 'library'
            ? { ...img, caption: editCaption }
            : img
        ));
        closeEdit();
        return;
      }

      const chapterId = parseInt(editChapterId) || editingImage.chapterId;
      const pageId = editPageId ? parseInt(editPageId) : null;

      const { error } =
        editingImage.source === 'gallery'
          ? await supabase
              .from('gallery')
              .update({
                image_caption: editCaption || null,
                chapter_id: chapterId,
                page_id: pageId,
              })
              .eq('id', editingImage.id)
          : await supabase
              .from('pages')
              .update({
                image_caption: editCaption || null,
                chapter_id: chapterId,
              })
              .eq('id', editingImage.id);

      if (error) {
        setSaveError(error.message || 'Something went wrong saving this photo.');
        return;
      }

      setImages((prev) => prev.map((img) =>
        img.id === editingImage.id && img.source === editingImage.source
          ? { ...img, caption: editCaption, chapterId, pageId,
              chapterName: chapters.find((c) => c.id === chapterId)?.title ?? img.chapterName }
          : img
      ));
      closeEdit();
    } catch (err: any) {
      setSaveError(err?.message || 'Something went wrong saving this photo.');
    } finally {
      setSaving(false);
    }
  };

  const promoteToPageImage = async () => {
    if (!editingImage || editingImage.source !== 'gallery' || !editPageId) return;
    const targetPageId = parseInt(editPageId);
    const targetPage = pages.find((p) => p.id === targetPageId);
    if (!targetPage) { setPromoteError('Could not find that page.'); return; }

    setPromoting(true);
    setPromoteError(null);
    try {
      const chapterId = parseInt(editChapterId) || editingImage.chapterId;

      if (targetPage.image_url) {
        const { error: demoteError } = await supabase.from('gallery').insert({
          chapter_id: chapterId,
          page_id: targetPageId,
          image_url: targetPage.image_url,
          image_caption: targetPage.image_caption ?? null,
          sort_order: 0,
        });
        if (demoteError) {
          setPromoteError(demoteError.message || 'Could not move the existing page photo to the gallery.');
          return;
        }
      }

      const { error: pageUpdateError } = await supabase
        .from('pages')
        .update({ image_url: editingImage.url, image_caption: editCaption || null })
        .eq('id', targetPageId);
      if (pageUpdateError) {
        setPromoteError(pageUpdateError.message || 'Could not set this as the page photo.');
        return;
      }

      const { error: deleteError } = await supabase.from('gallery').delete().eq('id', editingImage.id);
      if (deleteError) {
        setPromoteError('Photo was set on the page, but the original gallery copy could not be removed automatically.');
      }

      await load();
      closeEdit();
    } catch (err: any) {
      setPromoteError(err?.message || 'Something went wrong setting this as the page photo.');
    } finally {
      setPromoting(false);
    }
  };

  const downloadImage = (url: string, id: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-${Math.abs(id)}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pagesForChapter = pages.filter(
    (p) => p.chapter_id === parseInt(editChapterId || String(editingImage?.chapterId ?? 0))
  );

  const sourceLabel = (img: LibraryImage) => {
    if (img.source === 'gallery') return 'gallery';
    if (img.source === 'content') return 'inline';
    if (img.source === 'page') return 'page';
    if (img.source === 'chapter') return 'chapter header';
    if (img.source === 'library') return 'library';
    if (img.source === 'book') return img.id === BOOK_INTRO_ID ? 'intro' : 'cover';
    return img.source;
  };

  const sourceBadgeClass = (source: ImageSource) => {
    if (source === 'gallery') return 'bg-amber-500/90 text-white';
    if (source === 'content') return 'bg-blue-500/90 text-white';
    if (source === 'book') return 'bg-emerald-600/90 text-white';
    if (source === 'chapter') return 'bg-purple-500/90 text-white';
    if (source === 'library') return 'bg-slate-500/90 text-white';
    return 'bg-slate-700/80 text-white';
  };

  // For book/chapter images, most of the "move to chapter" / "assign to page"
  // editing UI doesn't apply — they're tied to a fixed book or chapter record.
  const isReassignable = editingImage?.source === 'gallery' || editingImage?.source === 'page';
  const showCaptionField =
    editingImage?.source === 'gallery' ||
    editingImage?.source === 'page' ||
    editingImage?.source === 'library' ||
    (editingImage?.source === 'book' && editingImage.id === BOOK_INTRO_ID);

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkInputRef.current?.click()}
                  disabled={bulkUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-avenir text-white bg-slate-800 rounded-full hover:bg-slate-900 disabled:opacity-50 transition-colors"
                >
                  {bulkUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {bulkUploading && bulkProgress
                    ? `Uploading ${bulkProgress.done}/${bulkProgress.total}…`
                    : 'Upload photos'}
                </button>
                <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {bulkError && (
              <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs font-avenir text-amber-800">
                {bulkError}
              </div>
            )}

            <p className="px-6 pt-3 text-xs font-avenir text-slate-400">
              Upload photos here any time — even before you know where they'll go. Pick them later from the
              "From your library" tab when inserting an inline image.
            </p>

            {/* Stats */}
            <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-3 sm:grid-cols-7 gap-3 shrink-0">
              {[
                { label: 'Total photos', value: stats.total },
                { label: 'Page images', value: stats.page },
                { label: 'Gallery photos', value: stats.gallery },
                { label: 'Inline (content)', value: stats.content },
                { label: 'Cover & headers', value: stats.bookAndChapter },
                { label: 'Library (unused)', value: stats.library },
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
                <option value="content">Inline (content)</option>
                <option value="book">Book cover / intro</option>
                <option value="chapter">Chapter headers</option>
                <option value="library">Library (unused)</option>
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
                        <span className={`absolute bottom-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sourceBadgeClass(img.source)}`}>
                          {sourceLabel(img)}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[11px] font-avenir text-slate-500 truncate">
                          {img.chapterName}
                          {img.pageLabel && (
                            <span className="text-slate-400"> · {img.pageLabel}</span>
                          )}
                        </p>
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
                          {img.source === 'library' && (
                            <button
                              onClick={() => deleteLibraryPhoto(img)}
                              className="p-1 rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors"
                              title="Remove from library"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit modal */}
            {editingImage && createPortal(
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeEdit}
                  className="fixed inset-0 bg-black/40 z-[60]"
                />
                <CropModal
                  open={cropping && editingImage !== null}
                  imageUrl={editingImage?.url ?? ''}
                  onCancel={() => setCropping(false)}
                  onSave={handleCropSave}
                />
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl pointer-events-auto"
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

                      {editingImage.source !== 'content' && (
                        <button
                          type="button"
                          onClick={() => setCropping(true)}
                          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-avenir font-semibold
                            text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Crop size={13} />
                          Crop / rotate this photo
                        </button>
                      )}

                      {saveError && (
                        <div className="px-3 py-2 text-xs font-avenir text-red-700 bg-red-50 border border-red-200 rounded-lg">
                          {saveError}
                        </div>
                      )}

                      {(editingImage.source === 'book' || editingImage.source === 'chapter') && (
                        <div className="px-3 py-2 text-xs font-avenir text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                          {editingImage.source === 'book' && editingImage.id === BOOK_COVER_ID &&
                            "This is the book's cover photo. It isn't tied to a chapter or page."}
                          {editingImage.source === 'book' && editingImage.id === BOOK_INTRO_ID &&
                            "This is the book's intro photo. It isn't tied to a chapter or page."}
                          {editingImage.source === 'chapter' &&
                            `This is the header photo for "${editingImage.chapterName}". It isn't tied to a specific page.`}
                        </div>
                      )}

                      {editingImage.source === 'library' && (
                        <div className="px-3 py-2 text-xs font-avenir text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                          This photo is in your library but not used anywhere yet. Pick it from the "From your
                          library" tab next time you insert an inline image.
                        </div>
                      )}

                      {showCaptionField && (
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
                      )}

                      {isReassignable && (
                        <>
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
                                onChange={(e) => { setEditPageId(e.target.value); setPromoteError(null); }}
                                className="w-full px-3 py-2 text-sm font-avenir text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white"
                              >
                                <option value="">Chapter gallery — not tied to a page</option>
                                {pagesForChapter.map((p) => (
                                  <option key={p.id} value={p.id}>{p.subtitle || `Page ${p.id}`}</option>
                                ))}
                              </select>

                              {editPageId && (
                                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                  <p className="text-xs font-avenir text-slate-500 mb-2">
                                    {pagesForChapter.find((p) => p.id === parseInt(editPageId))?.image_url
                                      ? 'This page already has a main photo. Promoting will move the existing one into the gallery.'
                                      : 'Use this photo as the main image for this page (left side), instead of a gallery thumbnail.'}
                                  </p>
                                  {promoteError && (
                                    <div className="mb-2 px-3 py-2 text-xs font-avenir text-red-700 bg-red-50 border border-red-200 rounded-lg">
                                      {promoteError}
                                    </div>
                                  )}
                                  <button
                                    onClick={promoteToPageImage}
                                    disabled={promoting}
                                    className="w-full px-3 py-2 text-xs font-avenir font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                                  >
                                    {promoting ? 'Setting as page photo…' : "Set as page's main photo →"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
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
                        {editingImage.source === 'library' && (
                          <button
                            onClick={() => deleteLibraryPhoto(editingImage)}
                            className="px-4 py-2 text-sm font-avenir text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={closeEdit}
                          className="px-4 py-2 text-sm font-avenir text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        {editingImage.source !== 'content' && (
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-avenir text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
                          >
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </AnimatePresence>,
              document.body
            )}
          </motion.aside>
        </>
      )}

      <input
        ref={bulkInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={onBulkInputChange}
        className="hidden"
      />
    </AnimatePresence>
  );
}
