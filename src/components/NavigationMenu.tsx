import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, SquarePen as PenSquare, Download, Loader2 } from 'lucide-react';
import { Book, Chapter } from '../lib/supabase';
import { fetchCompleteBookData } from '../utils/bookDataFetcher';
import { generateBookPDF } from '../utils/pdfBookGenerator';

const EDITOR_URL = 'https://edit.lastinglegacyonline.com';
const EDGE_FN    = 'https://uhzncrsbytxwdlmldwqf.supabase.co/functions/v1/story-editor';

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

  // ── PIN modal state ──────────────────────────────────────────
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

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
      if (!bookData) throw new Error('Failed to fetch book data');
      await generateBookPDF(bookData, (progress) => setPdfProgress(progress));
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError('Failed to generate PDF. Please try again.');
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    }
  };

  // ── PIN verification ─────────────────────────────────────────
  const openPinModal = () => {
    setPin('');
    setPinError('');
    setShowPinModal(true);
    setIsOpen(false); // close nav drawer first
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
        window.open(
          `${EDITOR_URL}?slug=${encodeURIComponent(book.slug)}&pin=${encodeURIComponent(pin)}`,
          '_blank'
        );
      } else {
        setPinError('Incorrect PIN. Find your PIN in the app under your book settings.');
      }
    } catch {
      setPinError('Something went wrong. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <>
      {/* ── Hamburger button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 z-40 p-3 bg-white rounded-full shadow-lg hover:bg-slate-50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-slate-800" />
      </button>

      {/* ── Nav drawer ── */}
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

              <div className="p-6 border-t border-slate-200 space-y-3">

                {/* ── Edit Story button ── */}
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

      {/* ── PIN Modal ── */}
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
                <a
                  href="https://app.lastinglegacyonline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 underline"
                >
                  Find it in the app
                </a>{' '}
                under your book settings.
              </p>

              {/* 4-box PIN input */}
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

