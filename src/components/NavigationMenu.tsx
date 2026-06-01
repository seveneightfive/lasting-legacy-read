import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, SquarePen as PenSquare, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase, Book, Chapter, Page } from '../lib/supabase';
import { fetchCompleteBookData } from '../utils/bookDataFetcher';
import { generateBookPDF } from '../utils/pdfBookGenerator';
import { sortPagesForDisplay } from '../utils/pageOrder';

const EDGE_FN    = 'https://uhzncrsbytxwdlmldwqf.supabase.co/functions/v1/story-editor';

interface NavigationMenuProps {
  book: Book;
  chapters: Chapter[];
  currentChapterIndex: number;
  currentPageIndex?: number;
  currentState: string;
  onNavigateToChapter: (index: number) => void;
  onNavigateToPage?: (chapterIndex: number, pageIndex: number) => void;
  onNavigateToGallery: () => void;
  onNavigateToGuestbook: () => void;
  onNavigateToTitle?: () => void;
}

export default function NavigationMenu({
  book,
  chapters,
  currentChapterIndex,
  currentPageIndex = 0,
  currentState,
  onNavigateToChapter,
  onNavigateToPage,
  onNavigateToGallery,
  onNavigateToGuestbook,
  onNavigateToTitle,
}: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // ── PIN modal state ──────────────────────────────────────────
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // ── TOC expansion + page cache ───────────────────────────────
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [pagesByChapter, setPagesByChapter] = useState<Record<number, Page[]>>({});
  const [loadingPagesFor, setLoadingPagesFor] = useState<Set<number>>(new Set());

  const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/site-images/LLO-SiteLogo.png`;

  // Resolve a display label for a page from any of the possible title
  // columns. Editor uses `subtitle` as the "Section Heading" field.
  const getPageLabel = (page: Page, fallbackIndex: number): string => {
    const p = page as Page & {
      subtitle?: string | null;
      title?: string | null;
      section_heading?: string | null;
      heading?: string | null;
      name?: string | null;
    };
    return (
      (p.subtitle && p.subtitle.trim()) ||
      (p.section_heading && p.section_heading.trim()) ||
      (p.title && p.title.trim()) ||
      (p.heading && p.heading.trim()) ||
      (p.name && p.name.trim()) ||
      `Page ${fallbackIndex + 1}`
    );
  };

  useEffect(() => {
    if (isOpen && currentState.includes('chapter') && chapters[currentChapterIndex]) {
      const activeId = chapters[currentChapterIndex].id;
      setExpandedChapters(prev => (prev[activeId] ? prev : { ...prev, [activeId]: true }));
      if (!pagesByChapter[activeId]) {
        void loadPagesForChapter(activeId);
      }
    }
  }, [isOpen, currentChapterIndex, currentState, chapters]);

 const loadPagesForChapter = async (chapterId: number) => {
  if (pagesByChapter[chapterId] || loadingPagesFor.has(chapterId)) return;
  setLoadingPagesFor(prev => new Set(prev).add(chapterId));
  try {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .or('is_deleted.is.null,is_deleted.eq.false');
    if (error) throw error;
    setPagesByChapter(prev => ({ ...prev, [chapterId]: sortPagesForDisplay(data || []) }));
  } catch (error) {
    console.error('Error loading pages for chapter:', error);
    setPagesByChapter(prev => ({ ...prev, [chapterId]: [] }));
  } finally {
    setLoadingPagesFor(prev => {
      const next = new Set(prev);
      next.delete(chapterId);
      return next;
    });
  }
};
  
  const toggleChapterExpansion = (chapterId: number) => {
    const willExpand = !expandedChapters[chapterId];
    setExpandedChapters(prev => ({ ...prev, [chapterId]: willExpand }));
    if (willExpand && !pagesByChapter[chapterId]) {
      void loadPagesForChapter(chapterId);
    }
  };

  const handleTitleClick = () => {
    if (onNavigateToTitle) {
      onNavigateToTitle();
      setIsOpen(false);
    }
  };

  const handleChapterClick = (index: number) => {
    onNavigateToChapter(index);
    setIsOpen(false);
  };

  const handlePageClick = (chapterIndex: number, pageIndex: number) => {
    if (onNavigateToPage) {
      onNavigateToPage(chapterIndex, pageIndex);
    } else {
      onNavigateToChapter(chapterIndex);
    }
    setIsOpen(false);
  };

  const handleGalleryClick = () => {
    onNavigateToGallery();
    setIsOpen(false);
  };

  const handleGuestbookClick = () => {
    onNavigateToGuestbook();
    setIsOpen(false);
  };

  const handleDownloadPDF = async () => {
  try {
    setIsGeneratingPDF(true);
    setPdfProgress(0);
    setPdfError(null);

    const bookData = await fetchCompleteBookData(book.id);
    if (!bookData) throw new Error('Failed to fetch book data');

    // Map to the shape pdfBookGenerator expects, filtering deleted pages
    // and sorting by final_order ?? sort_order
    const chaptersWithPages = bookData.chapters.map((ch) => ({
      ...ch,
      pages: sortPagesForDisplay(ch.pages),
    }));

    await downloadBookPDF(bookData.book, chaptersWithPages);
    setIsGeneratingPDF(false);
    setPdfProgress(0);
  } catch (error) {
    console.error('Error generating PDF:', error);
    setPdfError('Failed to generate PDF. Please try again.');
    setIsGeneratingPDF(false);
    setPdfProgress(0);
  }
};
  
  const openPinModal = () => {
    setPin('');
    setPinError('');
    setShowPinModal(true);
    setIsOpen(false);
  };

  const handlePinInput = (index: number, value: string) => {
    const digit = value.replace(/\D/, '');
    const digits = pin.split('');
    digits[index] = digit;
    const newPin = digits.join('');
    setPin(newPin);
    if (digit && index < 3) {
      document.getElementById(`pin-digit-${index + 1}`)?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      document.getElementById(`pin-digit-${index - 1}`)?.focus();
    }
    if (e.key === 'Enter') verifyPin();
  };

  const verifyPin = async () => {
    if (pin.length !== 4) {
      setPinError('Please enter all 4 digits.');
      return;
    }
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyPin', slug: book.slug, pin }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPinModal(false);
        setPin('');
        const editUrl = `/book/${encodeURIComponent(book.slug)}/edit?pin=${encodeURIComponent(pin)}`;
        window.location.href = editUrl;
      } else {
        setPinError('Incorrect PIN. Find your PIN in the app under your book settings.');
      }
    } catch {
      setPinError('Something went wrong. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const isChapterActive = (index: number) =>
    currentState.includes('chapter') && currentChapterIndex === index;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 z-40 p-3 bg-white rounded-full shadow-lg hover:bg-slate-50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-slate-800" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-avenir font-semibold text-slate-800">Table of Contents</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-8">
                  {onNavigateToTitle ? (
                    <button
                      onClick={handleTitleClick}
                      className="text-left w-full group"
                      aria-label="Return to title page"
                    >
                      <h3 className="text-2xl font-avenir font-bold text-slate-800 mb-2 leading-tight group-hover:text-slate-600 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-sm text-slate-600 font-avenir">by {book.author}</p>
                    </button>
                  ) : (
                    <>
                      <h3 className="text-2xl font-avenir font-bold text-slate-800 mb-2 leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-sm text-slate-600 font-avenir">by {book.author}</p>
                    </>
                  )}
                </div>

                <nav className="space-y-1">
                  {chapters.map((chapter, chapterIndex) => {
                    const isExpanded = !!expandedChapters[chapter.id];
                    const pages = pagesByChapter[chapter.id] || [];
                    const isLoading = loadingPagesFor.has(chapter.id);
                    const active = isChapterActive(chapterIndex);

                    return (
                      <div key={chapter.id}>
                        <div
                          className={`flex items-stretch rounded-lg overflow-hidden transition-colors ${
                            active ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <button
                            onClick={() => toggleChapterExpansion(chapter.id)}
                            className={`flex items-center justify-center px-2 ${
                              active ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
                            } transition-colors`}
                            aria-label={isExpanded ? 'Collapse chapter' : 'Expand chapter'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 opacity-75" />
                            ) : (
                              <ChevronRight className="w-4 h-4 opacity-75" />
                            )}
                          </button>
                          <button
                            onClick={() => handleChapterClick(chapterIndex)}
                            className="flex-1 text-left px-2 py-3"
                          >
                            <div className="font-avenir">
                              <div className="text-xs opacity-75 mb-1">Chapter {chapter.number}</div>
                              <div className="font-medium">{chapter.title}</div>
                              {chapter.lede && (
                                <div className="text-xs opacity-75 mt-1">{chapter.lede}</div>
                              )}
                            </div>
                          </button>
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="ml-6 mt-1 mb-2 border-l border-slate-200 pl-3 space-y-0.5">
                                {isLoading && (
                                  <div className="py-2 text-xs text-slate-400 font-avenir italic">
                                    Loading pages…
                                  </div>
                                )}

                                {!isLoading && pages.length === 0 && (
                                  <div className="py-2 text-xs text-slate-400 font-avenir italic">
                                    No pages yet
                                  </div>
                                )}

                                {!isLoading && pages.map((page, pageIndex) => {
                                  const isCurrentPage =
                                    currentState === 'chapter-content' &&
                                    currentChapterIndex === chapterIndex &&
                                    currentPageIndex === pageIndex;

                                  return (
                                    <button
                                      key={page.id}
                                      onClick={() => handlePageClick(chapterIndex, pageIndex)}
                                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm font-avenir transition-colors ${
                                        isCurrentPage
                                          ? 'bg-slate-200 text-slate-900 font-medium'
                                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                      }`}
                                    >
                                      {getPageLabel(page, pageIndex)}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {chapters.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                      <button
                        onClick={handleGalleryClick}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          currentState === 'gallery'
                            ? 'bg-slate-800 text-white'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="font-avenir font-medium">Gallery</div>
                      </button>
                      <button
                        onClick={handleGuestbookClick}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          currentState === 'guestbook'
                            ? 'bg-slate-800 text-white'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="font-avenir font-medium">Guestbook</div>
                      </button>
                    </div>
                  )}
                </nav>
              </div>

              <div className="p-6 border-t border-slate-200 space-y-3">
                <button
                  onClick={openPinModal}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-800 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors font-avenir font-medium"
                >
                  <PenSquare className="w-5 h-5" />
                  Edit Story
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-avenir font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating PDF {pdfProgress}%
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download PDF
                    </>
                  )}
                </button>

                {pdfError && (
                  <p className="text-red-600 text-sm text-center font-avenir">{pdfError}</p>
                )}

                {book.filloutform_link && (
                  <button
                    onClick={() => window.open(book.filloutform_link!, '_blank', 'noopener,noreferrer')}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir font-medium"
                  >
                    <PenSquare className="w-5 h-5" />
                    Sign My Guestbook
                  </button>
                )}

                <a
                  href="https://lastinglegacyonline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full max-w-[200px] mx-auto hover:opacity-80 transition-opacity"
                >
                  <img src={logoUrl} alt="Site Logo" className="w-full" />
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowPinModal(false); setPin(''); } }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm"
            >
              <h2 className="text-2xl font-avenir font-bold text-slate-800 mb-2 text-center">
                Edit This Story
              </h2>
              <p className="text-slate-500 text-sm mb-8 text-center leading-relaxed font-avenir">
                Enter your 4-digit edit PIN.{' '}
                <a href="https://app.lastinglegacyonline.com" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">Find it in the app</a>{' '}
                under your book settings.
              </p>

              <div className="flex gap-3 justify-center mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    id={`pin-digit-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i] || ''}
                    onChange={(e) => handlePinInput(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    className="w-14 h-14 text-center text-2xl font-bold border-2 border-slate-300 rounded-xl focus:border-slate-800 focus:outline-none transition-colors font-avenir"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-red-500 text-sm text-center mb-4 font-avenir">{pinError}</p>
              )}

              <button
                onClick={verifyPin}
                disabled={pinLoading || pin.length !== 4}
                className="w-full py-3 bg-slate-800 text-white rounded-full font-avenir font-semibold hover:bg-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
              >
                {pinLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                  </span>
                ) : (
                  'Open Editor →'
                )}
              </button>

              <button
                onClick={() => { setShowPinModal(false); setPin(''); }}
                className="w-full py-2 text-slate-400 text-sm font-avenir hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
