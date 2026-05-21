import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Book, Chapter, Page, GalleryItem } from '../../lib/supabase';
import { useAutosave } from '../../hooks/useAutosave';
import { EditorState, buildToc, flattenStates, nextState, prevState, stateKey } from '../../utils/editorState';
import SaveIndicator from './SaveIndicator';
import TableOfContents from './TableOfContents';
import CoverEditView from './CoverEditView';
import DedicationEditView from './DedicationEditView';
import IntroEditView from './IntroEditView';
import ChapterTitleEditView from './ChapterTitleEditView';
import PageEditView from './PageEditView';

interface BookEditorProps {
  book: Book;
  chapters: Chapter[];
  pin: string;
  onExit: () => void;
}

/**
 * BookEditor — state-machine driven editor that mirrors the BookReader flow.
 *
 *   cover → dedication → intro → chapter-title → page → page → chapter-title → …
 *
 * One state at a time, with a TOC drawer for jumping around and prev/next
 * arrows for sequential editing. Each state has its own split-screen layout.
 */
export default function BookEditor({ book, chapters: initialChapters, pin, onExit }: BookEditorProps) {
  // ── Editable state (local) ─────────────────────────────────────
  const [bookState, setBookState] = useState<Book>(book);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);

  // Pages cached per chapter ID (load lazily as user navigates)
  const [pagesByChapter, setPagesByChapter] = useState<Map<number, Page[]>>(new Map());
  const [galleryByPage, setGalleryByPage] = useState<Map<number, GalleryItem[]>>(new Map());

  // Current edit state
  const [current, setCurrent] = useState<EditorState>({ kind: 'cover' });
  const [tocOpen, setTocOpen] = useState(false);

  // ── Build TOC tree ─────────────────────────────────────────────
  const toc = useMemo(
    () => buildToc(bookState, chapters, pagesByChapter),
    [bookState, chapters, pagesByChapter]
  );
  const allStates = useMemo(() => flattenStates(toc), [toc]);

  // ── Eagerly load pages for the first chapter, then on demand ──
  useEffect(() => {
    // Load pages for the chapter we'd display first, so TOC is populated
    const firstChapter = chapters[0];
    if (firstChapter && !pagesByChapter.has(firstChapter.id)) {
      void loadPages(firstChapter.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPages = useCallback(async (chapterId: number) => {
    const { data } = await supabase
      .from('pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('sort_order', { ascending: true });
    if (data) {
      setPagesByChapter((prev) => {
        const next = new Map(prev);
        next.set(chapterId, data);
        return next;
      });
    }
  }, []);

  const loadGallery = useCallback(async (pageId: number) => {
    const { data } = await supabase
      .from('gallery')
      .select('*')
      .eq('page_id', pageId)
      .order('sort_order', { ascending: true });
    if (data) {
      setGalleryByPage((prev) => {
        const next = new Map(prev);
        next.set(pageId, data);
        return next;
      });
    }
  }, []);

  // When we navigate to a chapter or page, ensure its data is loaded
  useEffect(() => {
    if (current.kind === 'chapter-title' || current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      if (chapter && !pagesByChapter.has(chapter.id)) {
        void loadPages(chapter.id);
      }
    }
    if (current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      const pages = pagesByChapter.get(chapter?.id) ?? [];
      const page = pages[current.pageIndex];
      if (page && !galleryByPage.has(page.id)) {
        void loadGallery(page.id);
      }
    }
  }, [current, chapters, pagesByChapter, galleryByPage, loadPages, loadGallery]);

  // ── Save helpers ───────────────────────────────────────────────
  const logRevision = useCallback(async (params: {
    page_id?: number;
    chapter_id?: number;
    book_id?: number;
    field: string;
    previous_value?: string;
    new_value?: string;
  }) => {
    try {
      await supabase.from('page_revisions').insert({ ...params, edit_pin: pin });
    } catch (err) {
      console.error('Failed to log revision:', err);
    }
  }, [pin]);

  // ── Generic per-state autosaves ────────────────────────────────
  // Rather than 11 individual hooks, we maintain a "dirty payload" per state
  // and one autosave hook that flushes it. Cleaner state, fewer surprises.

  type DirtyPayload =
    | { kind: 'book';    changes: Partial<Book> }
    | { kind: 'chapter'; chapterId: number; changes: Partial<Chapter> }
    | { kind: 'page';    pageId: number; chapterId: number; changes: Partial<Page> };

  const [dirty, setDirty] = useState<DirtyPayload | null>(null);

  const persistDirty = useCallback(async (payload: DirtyPayload) => {
    if (Object.keys(payload.changes).length === 0) return;

    if (payload.kind === 'book') {
      const { error } = await supabase.from('books').update(payload.changes).eq('id', book.id);
      if (error) throw error;
      for (const [field, value] of Object.entries(payload.changes)) {
        void logRevision({
          book_id: book.id,
          field,
          new_value: value == null ? undefined : String(value),
        });
      }
    } else if (payload.kind === 'chapter') {
      const { error } = await supabase.from('chapters').update(payload.changes).eq('id', payload.chapterId);
      if (error) throw error;
      for (const [field, value] of Object.entries(payload.changes)) {
        void logRevision({
          chapter_id: payload.chapterId,
          book_id: book.id,
          field,
          new_value: value == null ? undefined : String(value),
        });
      }
    } else {
      const { error } = await supabase.from('pages').update(payload.changes).eq('id', payload.pageId);
      if (error) throw error;
      for (const [field, value] of Object.entries(payload.changes)) {
        void logRevision({
          page_id: payload.pageId,
          chapter_id: payload.chapterId,
          book_id: book.id,
          field,
          new_value: value == null ? undefined : String(value),
        });
      }
    }
  }, [book.id, logRevision]);

  const autosave = useAutosave({
    value: dirty,
    onSave: async (val) => {
      if (!val) return;
      await persistDirty(val);
      setDirty(null);
    },
    delay: 1500,
    resetKey: stateKey(current),  // flush on state change
  });

  // ── Update helpers used by the views ───────────────────────────
  const updateBook = (patch: Partial<Book>) => {
    setBookState((prev) => ({ ...prev, ...patch }));
    setDirty((prev) => {
      if (prev?.kind === 'book') return { kind: 'book', changes: { ...prev.changes, ...patch } };
      return { kind: 'book', changes: patch };
    });
  };

  const updateChapter = (chapterId: number, patch: Partial<Chapter>) => {
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)));
    setDirty((prev) => {
      if (prev?.kind === 'chapter' && prev.chapterId === chapterId) {
        return { kind: 'chapter', chapterId, changes: { ...prev.changes, ...patch } };
      }
      return { kind: 'chapter', chapterId, changes: patch };
    });
  };

  const updatePage = (pageId: number, chapterId: number, patch: Partial<Page>) => {
    setPagesByChapter((prev) => {
      const next = new Map(prev);
      const list = next.get(chapterId) ?? [];
      next.set(chapterId, list.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));
      return next;
    });
    setDirty((prev) => {
      if (prev?.kind === 'page' && prev.pageId === pageId) {
        return { kind: 'page', pageId, chapterId, changes: { ...prev.changes, ...patch } };
      }
      return { kind: 'page', pageId, chapterId, changes: patch };
    });
  };

  // ── Add to gallery (called from the editor toolbar's image button) ──
  const handleAddToGallery = useCallback(async (
    pageId: number, chapterId: number, imageUrl: string, caption?: string,
  ) => {
    const existing = galleryByPage.get(pageId) ?? [];
    const nextOrder = existing.length > 0
      ? Math.max(...existing.map((g) => g.sort_order ?? 0)) + 1
      : 0;
    const { error } = await supabase.from('gallery').insert({
      image_url: imageUrl,
      image_caption: caption,
      chapter_id: chapterId,
      page_id: pageId,
      sort_order: nextOrder,
    });
    if (error) {
      console.error('Failed to add to gallery:', error);
      return;
    }
    await loadGallery(pageId);
  }, [galleryByPage, loadGallery]);

  // ── Exit: flush + leave ────────────────────────────────────────
  const handleExit = async () => {
    await autosave.flush();
    onExit();
  };

  // ── Render the current view ────────────────────────────────────
  const view = renderCurrentView();

  function renderCurrentView(): React.ReactNode {
    if (current.kind === 'cover') {
      return <CoverEditView book={bookState} onChange={updateBook} />;
    }
    if (current.kind === 'dedication') {
      return <DedicationEditView book={bookState} onChange={updateBook} />;
    }
    if (current.kind === 'intro') {
      return <IntroEditView book={bookState} onChange={updateBook} />;
    }
    if (current.kind === 'chapter-title') {
      const chapter = chapters[current.chapterIndex];
      if (!chapter) return <NotFound />;
      return (
        <ChapterTitleEditView
          book={bookState}
          chapter={chapter}
          onChange={(patch) => updateChapter(chapter.id, patch)}
        />
      );
    }
    if (current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      if (!chapter) return <NotFound />;
      const pages = pagesByChapter.get(chapter.id);
      if (!pages) return <Loading />;
      const page = pages[current.pageIndex];
      if (!page) return <NotFound />;
      const galleryItems = galleryByPage.get(page.id) ?? [];
      return (
        <PageEditView
          book={bookState}
          chapter={chapter}
          page={page}
          galleryItems={galleryItems}
          pageNumber={current.pageIndex + 1}
          totalPages={pages.length}
          onChange={(patch) => updatePage(page.id, chapter.id, patch)}
          onAddToGallery={(url, caption) => handleAddToGallery(page.id, chapter.id, url, caption)}
          onGalleryChanged={() => loadGallery(page.id)}
        />
      );
    }
    return <NotFound />;
  }

  // ── Sequential nav ─────────────────────────────────────────────
  const goPrev = () => {
    const p = prevState(current, allStates);
    if (p) setCurrent(p);
  };
  const goNext = () => {
    const n = nextState(current, allStates);
    if (n) setCurrent(n);
  };
  const canPrev = !!prevState(current, allStates);
  const canNext = !!nextState(current, allStates);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setTocOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Open table of contents"
            >
              <Menu size={18} />
            </button>
            <div className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-avenir rounded-full shrink-0">
              Editing
            </div>
            <h1 className="text-sm md:text-base font-avenir text-slate-700 truncate">
              {bookState.title}
            </h1>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <div className="hidden sm:block">
              <SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} />
            </div>
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-avenir hover:bg-slate-900 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Exit Editor</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save indicator on mobile (below top bar) */}
      <div className="sm:hidden px-4 py-2 bg-white border-b border-slate-100 flex justify-end">
        <SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} />
      </div>

      {/* The view itself */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stateKey(current)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {view}
        </motion.div>
      </AnimatePresence>

      {/* Bottom prev/next bar */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          className="flex items-center gap-2 px-4 py-2 text-sm font-avenir text-slate-700 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          onClick={() => setTocOpen(true)}
          className="text-sm font-avenir text-slate-500 hover:text-slate-700 hidden md:block"
        >
          Jump to…
        </button>
        <button
          onClick={goNext}
          disabled={!canNext}
          className="flex items-center gap-2 px-4 py-2 text-sm font-avenir text-slate-700 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>

      {/* TOC drawer */}
      <TableOfContents
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        toc={toc}
        currentState={current}
        onNavigate={(s) => setCurrent(s)}
      />
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-10 text-center">
      <p className="text-slate-500 font-avenir">That section doesn't exist anymore.</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="p-10 text-center">
      <p className="text-slate-500 font-avenir">Loading…</p>
    </div>
  );
}
