import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, SquarePen as PenSquare, Download, Loader2 } from 'lucide-react';
import { Book, Chapter } from '../lib/supabase';
import { fetchCompleteBookData } from '../utils/bookDataFetcher';
import { generateBookPDF } from '../utils/pdfBookGenerator';

interface NavigationMenuProps {
  book: Book;
  chapters: Chapter[];
  currentChapterIndex: number;
  currentState: string;
  onNavigateToChapter: (index: number) => void;
  onNavigateToGallery: () => void;
  onNavigateToGuestbook: () => void;
}

export default function NavigationMenu({
  book,
  chapters,
  currentChapterIndex,
  currentState,
  onNavigateToChapter,
  onNavigateToGallery,
  onNavigateToGuestbook
}: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/site-images/LLO-SiteLogo.png`;

  const handleChapterClick = (index: number) => {
    onNavigateToChapter(index);
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

      if (!bookData) {
        throw new Error('Failed to fetch book data');
      }

      await generateBookPDF(bookData, (progress) => {
        setPdfProgress(progress);
      });

      setIsGeneratingPDF(false);
      setPdfProgress(0);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError('Failed to generate PDF. Please try again.');
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    }
  };

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
                  <h3 className="text-2xl font-avenir font-bold text-slate-800 mb-2 leading-tight">
                    {book.title}
                  </h3>
                  <p className="text-sm text-slate-600 font-avenir">by {book.author}</p>
                </div>

                <div>
                  <nav className="space-y-2">
                    {chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        onClick={() => handleChapterClick(index)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          currentState.includes('chapter') && currentChapterIndex === index
                            ? 'bg-slate-800 text-white'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="font-avenir">
                          <div className="text-xs opacity-75 mb-1">Chapter {chapter.number}</div>
                          <div className="font-medium">{chapter.title}</div>
                          {chapter.lede && (
                            <div className="text-xs opacity-75 mt-1">{chapter.lede}</div>
                          )}
                        </div>
                      </button>
                    ))}

                    {chapters.length > 0 && (
                      <>
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
                      </>
                    )}
                  </nav>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 space-y-4">
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
                  <img
                    src={logoUrl}
                    alt="Site Logo"
                    className="w-full"
                  />
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
