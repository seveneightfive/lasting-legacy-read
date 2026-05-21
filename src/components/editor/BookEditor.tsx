import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LogOut, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Book, Chapter, Page } from '../../lib/supabase';
import { useAutosave } from '../../hooks/useAutosave';
import RichTextEditor from './RichTextEditor';
import SaveIndicator from './SaveIndicator';

interface BookEditorProps {
  book: Book;
  chapters: Chapter[];
  pin: string;
  onExit: () => void;
}

type EditorTab = 'book' | 'chapter';

/**
 * BookEditor — the editable counterpart to BookReader.
 *
 * Architecture:
 *  - Local state mirrors the DB rows. Changes are debounced & autosaved.
 *  - Each save writes a row to `page_revisions` (audit + version history).
 *  - "Exit Editor" flushes pending saves and navigates back to the reader.
 */
export default function BookEditor({ book, chapters: initialChapters, pin, onExit }: BookEditorProps) {
  // ─── Local editable state ────────────────────────────────────
  const [bookState, setBookState] = useState<Book>(book);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [tab, setTab] = useState<EditorTab>('book');
  const [loading, setLoading] = useState(false);

  const currentChapter = chapters[currentChapterIndex];
  const currentPage = pages[currentPageIndex];

  // ─── Load pages when chapter changes ─────────────────────────
  useEffect(() => {
    if (!currentChapter) return;
    setLoading(true);
    supabase
      .from('pages')
      .select('*')
      .eq('chapter_id', currentChapter.id)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load pages:', error);
        } else {
          setPages(data || []);
          setCurrentPageIndex(0);
        }
        setLoading(false);
      });
  }, [currentChapter?.id]);

  // ─── Save helpers ────────────────────────────────────────────
  const logRevision = useCallback(async (params: {
    page_id?: number;
    chapter_id?: number;
    book_id?: number;
    field: string;
    previous_value?: string;
    new_value?: string;
  }) => {
    try {
      await supabase.from('page_revisions').insert({
        ...params,
        edit_pin: pin,
      });
    } catch (err) {
      console.error('Failed to log revision:', err);
    }
  }, [pin]);

  // ─── BOOK-LEVEL autosaves ────────────────────────────────────
  const saveBookField = useCallback(async (field: keyof Book, newValue: string, previousValue?: string) => {
    const { error } = await supabase
      .from('books')
      .update({ [field]: newValue })
      .eq('id', book.id);
    if (error) throw error;
    void logRevision({
      book_id: book.id,
      field: String(field),
      previous_value: previousValue,
      new_value: newValue,
    });
  }, [book.id, logRevision]);

  const bookTitleSave = useAutosave({
    value: bookState.title,
    onSave: async (v) => saveBookField('title', v, book.title),
  });
  const bookAuthorSave = useAutosave({
    value: bookState.author,
    onSave: async (v) => saveBookField('author', v, book.author),
  });
  const bookDedicationSave = useAutosave({
    value: bookState.dedication ?? '',
    onSave: async (v) => saveBookField('dedication', v, book.dedication),
  });
  const bookIntroSave = useAutosave({
    value: bookState.intro ?? '',
    onSave: async (v) => saveBookField('intro', v, book.intro),
  });

  // ─── CHAPTER-LEVEL autosaves ─────────────────────────────────
  const saveChapterField = useCallback(async (chapterId: number, field: keyof Chapter, newValue: string, previousValue?: string) => {
    const { error } = await supabase
      .from('chapters')
      .update({ [field]: newValue })
      .eq('id', chapterId);
    if (error) throw error;
    void logRevision({
      chapter_id: chapterId,
      book_id: book.id,
      field: String(field),
      previous_value: previousValue,
      new_value: newValue,
    });
  }, [book.id, logRevision]);

  const chapterTitleSave = useAutosave({
    value: currentChapter?.title ?? '',
    enabled: !!currentChapter,
    resetKey: currentChapter?.id,
    onSave: async (v) => {
      if (!currentChapter) return;
      await saveChapterField(currentChapter.id, 'title', v, initialChapters.find(c => c.id === currentChapter.id)?.title);
    },
  });
  const chapterLedeSave = useAutosave({
    value: currentChapter?.lede ?? '',
    enabled: !!currentChapter,
    resetKey: currentChapter?.id,
    onSave: async (v) => {
      if (!currentChapter) return;
      await saveChapterField(currentChapter.id, 'lede', v, initialChapters.find(c => c.id === currentChapter.id)?.lede);
    },
  });

  // ─── PAGE-LEVEL autosaves ────────────────────────────────────
  const savePageField = useCallback(async (pageId: number, field: keyof Page, newValue: string, previousValue?: string) => {
    const { error } = await supabase
      .from('pages')
      .update({ [field]: newValue })
      .eq('id', pageId);
    if (error) throw error;
    void logRevision({
      page_id: pageId,
      chapter_id: currentChapter?.id,
      book_id: book.id,
      field: String(field),
      previous_value: previousValue,
      new_value: newValue,
    });
  }, [book.id, currentChapter?.id, logRevision]);

  const pageContentSave = useAutosave({
    value: currentPage?.content ?? '',
    enabled: !!currentPage,
    resetKey: currentPage?.id,
    delay: 1500,
    onSave: async (v) => {
      if (!currentPage) return;
      await savePageField(currentPage.id, 'content', v);
    },
  });
  const pageSubtitleSave = useAutosave({
    value: currentPage?.subtitle ?? '',
    enabled: !!currentPage,
    resetKey: currentPage?.id,
    onSave: async (v) => {
      if (!currentPage) return;
      await savePageField(currentPage.id, 'subtitle', v);
    },
  });
  const pageQuoteSave = useAutosave({
    value: currentPage?.quote ?? '',
    enabled: !!currentPage,
    resetKey: currentPage?.id,
    onSave: async (v) => {
      if (!currentPage) return;
      await savePageField(currentPage.id, 'quote', v);
    },
  });
  const pageQuoteAttrSave = useAutosave({
    value: currentPage?.quote_attribute ?? '',
    enabled: !!currentPage,
    resetKey: currentPage?.id,
    onSave: async (v) => {
      if (!currentPage) return;
      await savePageField(currentPage.id, 'quote_attribute', v);
    },
  });
  const pageImageCaptionSave = useAutosave({
    value: currentPage?.image_caption ?? '',
    enabled: !!currentPage,
    resetKey: currentPage?.id,
    onSave: async (v) => {
      if (!currentPage) return;
      await savePageField(currentPage.id, 'image_caption', v);
    },
  });

  // ─── Aggregate save status ───────────────────────────────────
  const allStatuses = [
    bookTitleSave, bookAuthorSave, bookDedicationSave, bookIntroSave,
    chapterTitleSave, chapterLedeSave,
    pageContentSave, pageSubtitleSave, pageQuoteSave, pageQuoteAttrSave, pageImageCaptionSave,
  ];
  const aggregateStatus =
    allStatuses.find(s => s.status === 'error')?.status ??
    allStatuses.find(s => s.status === 'saving')?.status ??
    allStatuses.find(s => s.status === 'pending')?.status ??
    (allStatuses.some(s => s.status === 'saved') ? 'saved' : 'idle');
  const lastSavedAt = allStatuses
    .map(s => s.lastSavedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // ─── Exit: flush all pending saves, then leave ───────────────
  const handleExit = async () => {
    await Promise.all(allStatuses.map(s => s.flush()));
    onExit();
  };

  // ─── Update helpers (write to local state) ───────────────────
  const updateBook = (patch: Partial<Book>) =>
    setBookState(prev => ({ ...prev, ...patch }));
  const updateChapter = (patch: Partial<Chapter>) =>
    setChapters(prev => prev.map((c, i) =>
      i === currentChapterIndex ? { ...c, ...patch } : c
    ));
  const updatePage = (patch: Partial<Page>) =>
    setPages(prev => prev.map((p, i) =>
      i === currentPageIndex ? { ...p, ...patch } : p
    ));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-avenir rounded-full">
              Editing
            </div>
            <h1 className="text-sm md:text-base font-avenir text-slate-700 truncate">
              {bookState.title}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <SaveIndicator status={aggregateStatus} lastSavedAt={lastSavedAt} />
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-avenir hover:bg-slate-900 transition-colors"
            >
              <LogOut size={14} />
              Exit Editor
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 -mb-px">
          <TabButton active={tab === 'book'} onClick={() => setTab('book')}>
            <BookOpen size={14} />
            Book Details
          </TabButton>
          <TabButton active={tab === 'chapter'} onClick={() => setTab('chapter')}>
            Chapters & Pages
          </TabButton>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {tab === 'book' && (
          <BookDetailsPanel
            book={bookState}
            onChange={updateBook}
          />
        )}

        {tab === 'chapter' && (
          <ChapterPanel
            chapters={chapters}
            currentChapterIndex={currentChapterIndex}
            onSelectChapter={setCurrentChapterIndex}
            currentChapter={currentChapter}
            pages={pages}
            currentPageIndex={currentPageIndex}
            onSelectPage={setCurrentPageIndex}
            currentPage={currentPage}
            loading={loading}
            onChangeChapter={updateChapter}
            onChangePage={updatePage}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-avenir border-b-2 transition-colors
        ${active
          ? 'border-slate-800 text-slate-800'
          : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-2">
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-avenir text-slate-800 mb-4 heading-tracking">{title}</h2>
      {children}
    </section>
  );
}

// ── Book details panel ──────────────────────────────────────
function BookDetailsPanel({
  book, onChange,
}: { book: Book; onChange: (patch: Partial<Book>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Section title="Cover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FieldLabel>Title</FieldLabel>
            <input
              type="text"
              value={book.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
            />
          </div>
          <div>
            <FieldLabel>Author</FieldLabel>
            <input
              type="text"
              value={book.author}
              onChange={(e) => onChange({ author: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
            />
          </div>
        </div>
      </Section>

      <Section title="Dedication">
        <RichTextEditor
          value={book.dedication ?? ''}
          onChange={(html) => onChange({ dedication: html })}
          placeholder="A few words of dedication…"
        />
      </Section>

      <Section title="Introduction">
        <RichTextEditor
          value={book.intro ?? ''}
          onChange={(html) => onChange({ intro: html })}
          placeholder="Open the story with an introduction…"
        />
      </Section>
    </motion.div>
  );
}

// ── Chapter / Page editing panel ────────────────────────────
interface ChapterPanelProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  onSelectChapter: (i: number) => void;
  currentChapter?: Chapter;
  pages: Page[];
  currentPageIndex: number;
  onSelectPage: (i: number) => void;
  currentPage?: Page;
  loading: boolean;
  onChangeChapter: (patch: Partial<Chapter>) => void;
  onChangePage: (patch: Partial<Page>) => void;
}

function ChapterPanel({
  chapters, currentChapterIndex, onSelectChapter,
  currentChapter, pages, currentPageIndex, onSelectPage,
  currentPage, loading, onChangeChapter, onChangePage,
}: ChapterPanelProps) {
  if (!currentChapter) {
    return <p className="text-slate-500 font-avenir">No chapters yet.</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Chapter selector */}
      <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4">
        <FieldLabel>Chapter</FieldLabel>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectChapter(Math.max(0, currentChapterIndex - 1))}
            disabled={currentChapterIndex === 0}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
            aria-label="Previous chapter"
          >
            <ChevronLeft size={18} />
          </button>
          <select
            value={currentChapterIndex}
            onChange={(e) => onSelectChapter(Number(e.target.value))}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 bg-white"
          >
            {chapters.map((c, i) => (
              <option key={c.id} value={i}>
                Chapter {c.number}: {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => onSelectChapter(Math.min(chapters.length - 1, currentChapterIndex + 1))}
            disabled={currentChapterIndex === chapters.length - 1}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
            aria-label="Next chapter"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <Section title="Chapter Details">
        <div className="mb-4">
          <FieldLabel>Title</FieldLabel>
          <input
            type="text"
            value={currentChapter.title}
            onChange={(e) => onChangeChapter({ title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
          />
        </div>
        <div>
          <FieldLabel>Lede / subtitle</FieldLabel>
          <input
            type="text"
            value={currentChapter.lede ?? ''}
            onChange={(e) => onChangeChapter({ lede: e.target.value })}
            placeholder="A short subtitle for this chapter…"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
          />
        </div>
      </Section>

      {/* Page selector */}
      {loading ? (
        <p className="text-slate-500 font-avenir">Loading pages…</p>
      ) : pages.length === 0 ? (
        <p className="text-slate-500 font-avenir">This chapter has no pages yet.</p>
      ) : (
        <>
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4">
            <FieldLabel>Page</FieldLabel>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectPage(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              <select
                value={currentPageIndex}
                onChange={(e) => onSelectPage(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 bg-white"
              >
                {pages.map((p, i) => (
                  <option key={p.id} value={i}>
                    Page {i + 1}{p.subtitle ? ` — ${p.subtitle.slice(0, 60)}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onSelectPage(Math.min(pages.length - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {currentPage && (
            <PageEditor page={currentPage} onChange={onChangePage} />
          )}
        </>
      )}
    </motion.div>
  );
}

function PageEditor({
  page, onChange,
}: { page: Page; onChange: (patch: Partial<Page>) => void }) {
  return (
    <>
      <Section title="Page Heading">
        <FieldLabel>Subtitle</FieldLabel>
        <input
          type="text"
          value={page.subtitle ?? ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="A heading for this page…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
        />
      </Section>

      <Section title="Story Content">
        <RichTextEditor
          value={page.content ?? ''}
          onChange={(html) => onChange({ content: html })}
          placeholder="Write the story…"
        />
      </Section>

      <Section title="Pull Quote">
        <FieldLabel>Quote</FieldLabel>
        <RichTextEditor
          value={page.quote ?? ''}
          onChange={(html) => onChange({ quote: html })}
          placeholder="An optional pull quote for this page…"
          hideToolbar
        />
        <div className="mt-4">
          <FieldLabel>Attribution</FieldLabel>
          <input
            type="text"
            value={page.quote_attribute ?? ''}
            onChange={(e) => onChange({ quote_attribute: e.target.value })}
            placeholder="— Who said it"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
          />
        </div>
      </Section>

      {page.image_url && (
        <Section title="Image Caption">
          <div className="flex gap-4">
            <img
              src={page.image_url}
              alt=""
              className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
            />
            <div className="flex-1">
              <FieldLabel>Caption</FieldLabel>
              <input
                type="text"
                value={page.image_caption ?? ''}
                onChange={(e) => onChange({ image_caption: e.target.value })}
                placeholder="A caption for this image…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none"
              />
              <p className="mt-2 text-xs text-slate-400 font-avenir">
                Image uploading is managed elsewhere — only the caption is editable here.
              </p>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
