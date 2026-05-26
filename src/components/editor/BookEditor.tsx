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
import { sortPagesForDisplay, effectiveOrder } from '../../utils/pageOrder';

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
 * The top bar shows context-specific breadcrumbs only for views that don't
 * already display their own heading (Intro, Page). Cover/Dedication/ChapterTitle
 * own their visual heading internally and keep the top bar minimal.
 */
export default function BookEditor({ book, chapters: initialChapters, pin, onExit }: BookEditorProps) {
  // ── Editable state ─────────────────────────────────────────────
  const [bookState, setBookState] = useState<Book>(book);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);

  const [pagesByChapter, setPagesByChapter] = useState<Map<number, Page[]>>(new Map());
  const [galleryByPage, setGalleryByPage] = useState<Map<number, GalleryItem[]>>(new Map());

  const [current, setCurrent] = useState<EditorState>({ kind: 'cover' });
  const [tocOpen, setTocOpen] = useState(false);

  const toc = useMemo(
    () => buildToc(bookState, chapters, pagesByChapter),
    [bookState, chapters, pagesByChapter]
  );
  const allStates = useMemo(() => flattenStates(toc), [toc]);

  // Load first chapter's pages eagerly for TOC
  useEffect(() => {
    const firstChapter = chapters[0];
    if (firstChapter && !pagesByChapter.has(firstChapter.id)) {
      void loadPages(firstChapter.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPages = useCallback(async (chapterId: number) => {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .or('is_deleted.is.null,is_deleted.eq.false');  // tolerate legacy NULLs
    if (error) {
      console.error('Failed to load pages:', error);
      return;
    }
    if (data) {
      const sorted = sortPagesForDisplay(data);
      setPagesByChapter((prev) => {
        const next = new Map(prev);
        next.set(chapterId, sorted);
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

  // ── Revisions ──────────────────────────────────────────────────
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

  // ── Single-payload autosave ────────────────────────────────────
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
    resetKey: stateKey(current),
  });

  // ── Update helpers ─────────────────────────────────────────────
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

  // ── Soft-delete a page ─────────────────────────────────────────
  // We do NOT hard-delete because Whalesync uses Supabase rows to know
  // which Glide questions have been answered. A hard delete would let
  // Whalesync re-create the page on its next sync. Instead we mark
  // is_deleted=true and filter on read. Whalesync should be configured
  // to leave rows where is_deleted=true alone.
  const handleDeletePage = useCallback(async (pageId: number, chapterId: number) => {
    const pagesInChapter = pagesByChapter.get(chapterId) ?? [];
    const pageToDelete = pagesInChapter.find((p) => p.id === pageId);
    if (!pageToDelete) return;

    const label = pageToDelete.subtitle?.trim() || `Page ${effectiveOrder(pageToDelete) + 1}`;
    const ok = window.confirm(
      `Delete "${label}"?\n\nThe page will be hidden from your story. Photos linked to it will also be hidden. ` +
      `This can be undone by your administrator if needed.`
    );
    if (!ok) return;

    // Flush any pending edits to this page first
    if (dirty?.kind === 'page' && dirty.pageId === pageId) {
      setDirty(null);
    } else {
      await autosave.flush();
    }

    // Soft-delete the page
    const { error: pageErr } = await supabase
      .from('pages')
      .update({ is_deleted: true })
      .eq('id', pageId);
    if (pageErr) {
      console.error('Failed to delete page:', pageErr);
      window.alert('Could not delete this page. Please try again.');
      return;
    }

    // Log revision so it's auditable / recoverable
    void logRevision({
      page_id: pageId,
      chapter_id: chapterId,
      book_id: book.id,
      field: 'is_deleted',
      previous_value: 'false',
      new_value: 'true',
    });

    // Renumber final_order on remaining active pages.
    // We rewrite final_order only — sort_order stays untouched (Glide-owned).
    const remaining = pagesInChapter
      .filter((p) => p.id !== pageId)
      .map((p, i) => ({ ...p, final_order: i }));

    await Promise.all(
      remaining
        .filter((p) => {
          const before = pagesInChapter.find((x) => x.id === p.id);
          return before?.final_order !== p.final_order;
        })
        .map((p) =>
          supabase.from('pages').update({ final_order: p.final_order }).eq('id', p.id)
        )
    );

    // Update local state
    setPagesByChapter((prev) => {
      const next = new Map(prev);
      next.set(chapterId, remaining);
      return next;
    });
    setGalleryByPage((prev) => {
      const next = new Map(prev);
      next.delete(pageId);
      return next;
    });

    // Navigate away if we were viewing the deleted page
    if (current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      if (chapter?.id === chapterId) {
        const deletedIndex = pagesInChapter.findIndex((p) => p.id === pageId);
        if (deletedIndex === current.pageIndex) {
          if (remaining.length > 0) {
            const newIndex = Math.min(current.pageIndex, remaining.length - 1);
            setCurrent({ kind: 'page', chapterIndex: current.chapterIndex, pageIndex: newIndex });
          } else {
            setCurrent({ kind: 'chapter-title', chapterIndex: current.chapterIndex });
          }
        } else if (deletedIndex < current.pageIndex) {
          setCurrent({
            kind: 'page',
            chapterIndex: current.chapterIndex,
            pageIndex: current.pageIndex - 1,
          });
        }
      }
    }
  }, [pagesByChapter, dirty, autosave, current, chapters, book.id, logRevision]);

  // ── Reorder pages within a chapter ─────────────────────────────
  // Writes final_order ONLY. sort_order is owned by Glide/Whalesync and
  // stays untouched so the question-answered state remains intact.
  const handleReorderPages = useCallback(async (
    chapterId: number,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (fromIndex === toIndex) return;
    const existing = pagesByChapter.get(chapterId) ?? [];
    if (fromIndex < 0 || fromIndex >= existing.length) return;
    if (toIndex < 0 || toIndex >= existing.length) return;

    const reordered = [...existing];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Reassign final_order sequentially. sort_order is left alone.
    const renumbered = reordered.map((p, i) => ({ ...p, final_order: i }));

    // Optimistic local update
    setPagesByChapter((prev) => {
      const next = new Map(prev);
      next.set(chapterId, renumbered);
      return next;
    });

    // Persist only rows whose final_order actually changed
    const changed = renumbered.filter((p) => {
      const before = existing.find((x) => x.id === p.id);
      return before?.final_order !== p.final_order;
    });

    try {
      await Promise.all(
        changed.map((p) =>
          supabase.from('pages').update({ final_order: p.final_order }).eq('id', p.id)
        )
      );
      void logRevision({
        chapter_id: chapterId,
        book_id: book.id,
        field: 'final_order',
        new_value: `reordered ${changed.length} page(s)`,
      });
    } catch (err) {
      console.error('Failed to persist reorder:', err);
      // Roll back
      setPagesByChapter((prev) => {
        const next = new Map(prev);
        next.set(chapterId, existing);
        return next;
      });
      window.alert('Could not save the new page order. Please try again.');
      return;
    }

    // Keep tracking the same page if it moved
    if (current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      if (chapter?.id === chapterId) {
        const oldId = existing[current.pageIndex]?.id;
        const newIdx = renumbered.findIndex((p) => p.id === oldId);
        if (newIdx >= 0 && newIdx !== current.pageIndex) {
          setCurrent({ kind: 'page', chapterIndex: current.chapterIndex, pageIndex: newIdx });
        }
      }
    }
  }, [pagesByChapter, current, chapters, book.id, logRevision]);

  const handleExit = async () => {
    await autosave.flush();
    onExit();
  };

  // ── Render current view ────────────────────────────────────────
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

  // ── Top-bar breadcrumb ─────────────────────────────────────────
  // Only shown for views that don't already display their own heading.
  function renderBreadcrumb(): React.ReactNode {
    if (current.kind === 'intro') {
      return <BreadcrumbPill>Introduction</BreadcrumbPill>;
    }
    if (current.kind === 'page') {
      const chapter = chapters[current.chapterIndex];
      const pages = pagesByChapter.get(chapter?.id) ?? [];
      if (!chapter || pages.length === 0) return null;
      return (
        <BreadcrumbPill>
          Chapter {chapter.number}
          {chapter.title ? `: ${chapter.title}` : ''} —
          {' '}Page <span className="text-green-700 font-semibold">{current.pageIndex + 1}</span>
          {' '}of {pages.length}
        </BreadcrumbPill>
      );
    }
    return null;
  }

  // ── Nav ────────────────────────────────────────────────────────
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
        <div className="max-w-full px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setTocOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Open table of contents"
            >
              <Menu size={18} />
            </button>
            <div className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-avenir rounded-full shrink-0">
              Editing
            </div>
            <h1 className="text-sm md:text-base font-avenir text-slate-700 truncate shrink min-w-0">
              {bookState.title}
            </h1>
            <div className="hidden md:block min-w-0 truncate">
              {renderBreadcrumb()}
            </div>
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

        {/* Mobile breadcrumb (sits below the main row) */}
        <div className="md:hidden px-4 pb-2">
          {renderBreadcrumb()}
        </div>
      </div>

      {/* Mobile save indicator */}
      <div className="sm:hidden px-4 py-2 bg-white border-b border-slate-100 flex justify-end">
        <SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} />
      </div>

      {/* Current view */}
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

      {/* Bottom prev/next */}
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
        onDeletePage={handleDeletePage}
        onReorderPages={handleReorderPages}
      />
    </div>
  );
}

function BreadcrumbPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs md:text-sm font-avenir text-slate-500 uppercase tracking-wider truncate inline-block">
      {children}
    </span>
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
