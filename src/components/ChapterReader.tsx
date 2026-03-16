import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import { Chapter, Page } from '../lib/supabase';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface ChapterReaderProps {
  chapter: Chapter;
  page: Page;
  pageNumber: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
}

export default function ChapterReader({
  chapter,
  page,
  pageNumber,
  totalPages,
  onNext,
  onPrevious
}: ChapterReaderProps) {
  const isDesktop = useIsDesktop();
  const useSplitScreen = isDesktop && totalPages >= 2;
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    const handleNext = () => setSlideDirection('left');
    const handlePrev = () => setSlideDirection('right');

    return () => {};
  }, []);

  const handleNextClick = () => {
    setSlideDirection('left');
    onNext();
  };

  const handlePreviousClick = () => {
    setSlideDirection('right');
    onPrevious();
  };

  if (!useSplitScreen) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-white p-8 flex items-center"
      >
        <div className="max-w-3xl mx-auto w-full">
          <div className="mb-8">
            <p className="text-slate-500 text-sm font-avenir">
              Chapter {chapter.number}: {chapter.title}
            </p>
          </div>

          {page.image_url && (
            <div className="mb-8">
              <img
                src={page.image_url}
                alt={page.image_caption || 'Chapter image'}
                className="w-full rounded-lg shadow-md"
              />
              {page.image_caption && (
                <p className="text-sm text-slate-600 mt-2 italic font-lora">
                  {page.image_caption}
                </p>
              )}
            </div>
          )}

          {page.subtitle && (
            <h3 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">
              {page.subtitle}
            </h3>
          )}

          {page.quote && (
            <blockquote className="text-xl font-lora italic text-slate-700 mb-8 pl-6 border-l-4 border-slate-300 leading-body-relaxed quote-tracking">
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(page.quote)
                }}
              />
              {page.quote_attribute && (
                <footer className="text-base text-slate-600 mt-4 not-italic">
                  — {page.quote_attribute}
                </footer>
              )}
            </blockquote>
          )}

          {page.content && (
            <div
              className="markdown-body font-lora text-slate-800 mb-12 leading-body-relaxed body-tracking"
              dangerouslySetInnerHTML={{
                __html: marked.parse(page.content)
              }}
            />
          )}

          <div className="flex justify-between items-center pt-8 border-t border-slate-200">
            <button
              onClick={handlePreviousClick}
              className="px-6 py-2 font-avenir text-slate-600 hover:text-slate-800 transition-colors"
            >
              ← Previous
            </button>

            <span className="text-slate-500 text-sm font-avenir">
              Page {pageNumber} of {totalPages}
            </span>

            <button
              onClick={handleNextClick}
              className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-white">
      <div className="w-1/2 h-screen flex flex-col bg-slate-50 overflow-hidden relative">
        <div className="px-12 pt-12 pb-6">
          <p className="text-slate-500 text-sm font-avenir mb-2">
            Chapter {chapter.number}: {chapter.title}
          </p>
          {chapter.lede && (
            <p className="text-slate-600 text-base font-lora italic leading-relaxed">
              {chapter.lede}
            </p>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {page.image_url ? (
              <motion.div
                key={`image-${pageNumber}`}
                initial={{ x: slideDirection === 'left' ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection === 'left' ? -300 : 300, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="w-full h-full flex flex-col items-center justify-center px-12"
              >
                <div className="max-w-2xl w-full">
                  <img
                    src={page.image_url}
                    alt={page.image_caption || 'Chapter image'}
                    className="w-full rounded-lg shadow-lg object-contain max-h-[60vh]"
                  />
                  {page.image_caption && (
                    <p className="text-sm text-slate-600 mt-4 italic font-lora text-center">
                      {page.image_caption}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : page.subtitle ? (
              <motion.div
                key={`subtitle-${pageNumber}`}
                initial={{ x: slideDirection === 'left' ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection === 'left' ? -300 : 300, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="w-full h-full flex items-center justify-center bg-slate-800 p-12"
              >
                <h2 className="text-5xl font-avenir text-white text-center leading-tight">
                  {page.subtitle}
                </h2>
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${pageNumber}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex items-center justify-center"
              >
                <div className="text-slate-400 text-lg font-avenir">No visual content</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-1/2 h-screen flex flex-col items-center justify-center relative">
        <div className="w-full max-w-3xl mx-auto overflow-y-auto px-12" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {page.subtitle && (
            <h3 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">
              {page.subtitle}
            </h3>
          )}

          {page.quote && (
            <blockquote className="text-xl font-lora italic text-slate-700 mb-8 pl-6 border-l-4 border-slate-300 leading-body-relaxed quote-tracking">
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(page.quote)
                }}
              />
              {page.quote_attribute && (
                <footer className="text-base text-slate-600 mt-4 not-italic">
                  — {page.quote_attribute}
                </footer>
              )}
            </blockquote>
          )}

          {page.content && (
            <div
              className="markdown-body font-lora text-slate-800 mb-12 leading-body-relaxed body-tracking"
              dangerouslySetInnerHTML={{
                __html: marked.parse(page.content)
              }}
            />
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-8">
          <div className="flex justify-between items-center max-w-3xl mx-auto">
            <button
              onClick={handlePreviousClick}
              className="px-6 py-2 font-avenir text-slate-600 hover:text-slate-800 transition-colors"
            >
              ← Previous
            </button>

            <span className="text-slate-500 text-sm font-avenir">
              Page {pageNumber} of {totalPages}
            </span>

            <button
              onClick={handleNextClick}
              className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
