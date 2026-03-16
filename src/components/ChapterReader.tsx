import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import { Chapter, Page, GalleryItem } from '../lib/supabase';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface ChapterReaderProps {
  chapter: Chapter;
  page: Page;
  pageNumber: number;
  totalPages: number;
  galleryItems: GalleryItem[];  // ← ADDED: gallery items for this chapter
  onNext: () => void;
  onPrevious: () => void;
}

// Render page content — handles both HTML (from new editor) and markdown (from Glide)
function renderContent(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  // If content is already HTML, return as-is
  if (trimmed.startsWith('<')) return trimmed;
  // Otherwise parse as markdown
  return marked.parse(content) as string;
}

// Get gallery images linked to a specific page
function getPageImages(galleryItems: GalleryItem[], pageId: number): GalleryItem[] {
  return galleryItems
    .filter(g => g.page_id === pageId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// Render inline images for a page
function PageImages({ images }: { images: GalleryItem[] }) {
  if (!images.length) return null;

  if (images.length === 1) {
    const img = images[0];
    return (
      <figure className="my-6">
        <img
          src={img.image_url}
          alt={img.image_caption || ''}
          className="w-full rounded-lg shadow-md object-cover"
          loading="lazy"
        />
        {img.image_caption && (
          <figcaption className="text-sm text-slate-500 italic font-lora text-center mt-2">
            {img.image_caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Multiple images — grid layout
  const gridClass = images.length === 2
    ? 'grid grid-cols-2 gap-3'
    : 'grid grid-cols-2 md:grid-cols-3 gap-3';

  return (
    <div className={`${gridClass} my-6`}>
      {images.map(img => (
        <figure key={img.id} className="m-0">
          <img
            src={img.image_url}
            alt={img.image_caption || ''}
            className="w-full rounded-lg shadow-sm object-cover aspect-[4/3]"
            loading="lazy"
          />
          {img.image_caption && (
            <figcaption className="text-xs text-slate-500 italic font-lora text-center mt-1">
              {img.image_caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export default function ChapterReader({
  chapter,
  page,
  pageNumber,
  totalPages,
  galleryItems,
  onNext,
  onPrevious
}: ChapterReaderProps) {
  const isDesktop = useIsDesktop();
  const useSplitScreen = isDesktop && totalPages >= 2;
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const pageImages = getPageImages(galleryItems, page.id);
  const contentHtml = renderContent(page.content || '');

  const handleNextClick = () => { setSlideDirection('left'); onNext(); };
  const handlePreviousClick = () => { setSlideDirection('right'); onPrevious(); };

  // ── MOBILE / SINGLE COLUMN ────────────────────────────────────
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

          {/* Header image from pages.image_url */}
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
                dangerouslySetInnerHTML={{ __html: marked.parse(page.quote) as string }}
              />
              {page.quote_attribute && (
                <footer className="text-base text-slate-600 mt-4 not-italic">
                  — {page.quote_attribute}
                </footer>
              )}
            </blockquote>
          )}

          {/* Main content */}
          {page.content && (
            <div
              className="markdown-body font-lora text-slate-800 mb-6 leading-body-relaxed body-tracking"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}

          {/* ← NEW: Inline gallery images linked to this page */}
          <PageImages images={pageImages} />

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

  // ── DESKTOP SPLIT SCREEN ──────────────────────────────────────
  return (
    <div className="fixed inset-0 flex bg-white">
      {/* LEFT: Image panel */}
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
            {/* Show page image, or first gallery image, or subtitle card, or placeholder */}
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
            ) : pageImages.length > 0 ? (
              /* ← NEW: Show first gallery image on the left panel */
              <motion.div
                key={`gallery-${pageNumber}`}
                initial={{ x: slideDirection === 'left' ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection === 'left' ? -300 : 300, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="w-full h-full flex flex-col items-center justify-center px-12"
              >
                <div className="max-w-2xl w-full">
                  <img
                    src={pageImages[0].image_url}
                    alt={pageImages[0].image_caption || ''}
                    className="w-full rounded-lg shadow-lg object-contain max-h-[60vh]"
                  />
                  {pageImages[0].image_caption && (
                    <p className="text-sm text-slate-600 mt-4 italic font-lora text-center">
                      {pageImages[0].image_caption}
                    </p>
                  )}
                  {/* Show remaining images in a small strip below */}
                  {pageImages.length > 1 && (
                    <div className="flex gap-2 mt-4 justify-center">
                      {pageImages.slice(1).map(img => (
                        <img
                          key={img.id}
                          src={img.image_url}
                          alt={img.image_caption || ''}
                          className="w-20 h-20 object-cover rounded-md shadow-sm"
                        />
                      ))}
                    </div>
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

      {/* RIGHT: Text panel */}
      <div className="w-1/2 h-screen flex flex-col items-center justify-center relative">
        <div
          className="w-full max-w-3xl mx-auto overflow-y-auto px-12"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {page.subtitle && (
            <h3 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">
              {page.subtitle}
            </h3>
          )}

          {page.quote && (
            <blockquote className="text-xl font-lora italic text-slate-700 mb-8 pl-6 border-l-4 border-slate-300 leading-body-relaxed quote-tracking">
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: marked.parse(page.quote) as string }}
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
              className="markdown-body font-lora text-slate-800 mb-6 leading-body-relaxed body-tracking"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}

          {/* ← NEW: Additional gallery images (2nd and beyond) shown inline in text panel */}
          {pageImages.length > 1 && (
            <PageImages images={pageImages.slice(1)} />
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
