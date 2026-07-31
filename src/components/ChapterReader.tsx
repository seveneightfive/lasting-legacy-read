import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Chapter, Page, GalleryItem } from '../lib/supabase';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface ChapterReaderProps {
  chapter: Chapter;
  page: Page;
  pageNumber: number;
  totalPages: number;
  galleryItems: GalleryItem[];
  onNext: () => void;
  onPrevious: () => void;
}

function renderContent(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return trimmed;
  return marked.parse(content) as string;
}

function getPageImages(galleryItems: GalleryItem[], pageId: number): GalleryItem[] {
  return galleryItems
    .filter(g => g.page_id === pageId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// Gallery page lightbox — same pattern as ChapterGallery.tsx / ChapterSpecificGallery.tsx,
// just scoped to one page's photos instead of a whole chapter or the whole book.
function GalleryLightbox({ images, index, onClose, onPrevious, onNext }: {
  images: GalleryItem[]; index: number; onClose: () => void;
  onPrevious: () => void; onNext: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrevious();
    if (e.key === 'ArrowRight') onNext();
  };

  const img = images[index];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10" aria-label="Close">
        <X className="w-7 h-7" />
      </button>

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors z-10"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-9 h-9 md:w-10 md:h-10" />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors z-10"
          aria-label="Next photo"
        >
          <ChevronRight className="w-9 h-9 md:w-10 md:h-10" />
        </button>
      )}

      <div className="max-w-5xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <motion.img
          key={index}
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          src={img.image_url}
          alt={img.image_title || img.image_caption || 'Photo'}
          className="max-h-[78vh] w-auto object-contain rounded"
        />
        {(img.image_title || img.image_caption) && (
          <div className="mt-5 text-center max-w-xl px-4">
            {img.image_title && <p className="text-white font-semibold font-avenir text-base leading-snug">{img.image_title}</p>}
            {img.image_caption && <p className="text-slate-400 font-avenir text-sm mt-1 leading-snug">{img.image_caption}</p>}
          </div>
        )}
        <p className="text-slate-600 text-xs mt-4 font-avenir">{index + 1} / {images.length}</p>
      </div>
    </motion.div>
  );
}

// Used only for gallery pages (page.gallery_page === true)
function GalleryPageLayout({ page, images, pageNumber, totalPages, chapter, onNext, onPrevious }: {
  page: Page; images: GalleryItem[]; pageNumber: number; totalPages: number;
  chapter: Chapter; onNext: () => void; onPrevious: () => void;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-8">
        {page.subtitle && (
          <h2 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">{page.subtitle}</h2>
        )}
        {images.length === 0 ? (
          <p className="text-slate-400 text-sm font-avenir">No photos on this page yet.</p>
        ) : (
          <>
            <div className="hidden md:block" style={{ columns: 3, columnGap: '0.75rem' }}>
              {images.map((img, i) => (
                <div key={img.id} className="break-inside-avoid mb-3">
                  <GalleryCell img={img} onClick={() => setLightboxIndex(i)} />
                </div>
              ))}
            </div>
            <div className="flex md:hidden gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory">
              {images.map((img, i) => (
                <div key={img.id} className="flex-none w-[75vw] snap-start">
                  <GalleryCell img={img} onClick={() => setLightboxIndex(i)} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <p className="md:hidden text-xs text-slate-400 mt-2 text-center font-avenir">Tap a photo to view full size</p>
            )}
          </>
        )}
      </div>
      <div className="border-t border-slate-200 bg-white px-8 pt-4 pb-6">
        <div className="max-w-2xl mx-auto mb-2">
          <p className="text-slate-400 text-xs font-avenir">
            Chapter {chapter.number}: {chapter.title}
            {chapter.lede && <span className="italic"> — {chapter.lede}</span>}
          </p>
        </div>
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <button onClick={onPrevious} className="px-6 py-2 font-avenir text-slate-600 hover:text-slate-800 transition-colors">← Previous</button>
          <span className="text-slate-500 text-sm font-avenir">Page {pageNumber} of {totalPages}</span>
          <button onClick={onNext} className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors">Next →</button>
        </div>
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <GalleryLightbox
            images={images}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrevious={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
            onNext={() => setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GalleryCell({ img, onClick }: { img: GalleryItem; onClick: () => void }) {
  return (
    <figure
      className="m-0 relative overflow-hidden rounded-lg bg-slate-100 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <img src={img.image_url} alt={img.image_caption || img.image_title || ''} className="w-full h-auto block" loading="lazy" />
      {(img.image_title || img.image_caption) && (
        <figcaption className="px-3 py-2 bg-white border-t border-slate-100">
          {img.image_title && <p className="text-slate-700 text-xs font-avenir font-medium leading-tight">{img.image_title}</p>}
          {img.image_caption && img.image_caption !== img.image_title && (
            <p className="text-slate-500 text-xs font-lora italic leading-tight mt-0.5">{img.image_caption}</p>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export default function ChapterReader({ chapter, page, pageNumber, totalPages, galleryItems, onNext, onPrevious }: ChapterReaderProps) {
  const isDesktop = useIsDesktop();
  const useSplitScreen = isDesktop && totalPages >= 2;
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Mobile-only: chrome (chapter label + progress dots + Prev/Next) hides
  // when the reader taps the photo, so the story photo can go full-bleed.
  // Resets to visible on every page change so it never gets stuck hidden.
  const [chromeVisible, setChromeVisible] = useState(true);
  useEffect(() => {
    setChromeVisible(true);
  }, [pageNumber]);

  // pageImages used only for gallery pages and the left-panel fallback
  const pageImages = getPageImages(galleryItems, page.id);
  const contentHtml = renderContent(page.content || '');

  const handleNextClick = () => { setSlideDirection('left'); onNext(); };
  const handlePreviousClick = () => { setSlideDirection('right'); onPrevious(); };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pageNumber]);

  // Gallery page — author toggled "Make this a photo page"
  // Data in Supabase is untouched; nothing deleted.
  if (page.gallery_page) {
    return (
      <GalleryPageLayout
        page={page} images={pageImages} pageNumber={pageNumber}
        totalPages={totalPages} chapter={chapter}
        onNext={handleNextClick} onPrevious={handlePreviousClick}
      />
    );
  }

  // MOBILE — inline images in contentHtml render naturally.
  // Gallery items attached to this page are NOT rendered here;
  // they remain safe in Supabase and visible in the Photo Library.
  //
  // Tapping the chapter photo toggles the chrome (top label already
  // lives in NavigationMenu's fixed button; here "chrome" is the
  // bottom bar: progress dots + Prev/Next) so the photo can fill the
  // screen the way turning a real page would.
  if (!useSplitScreen) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.5 }}
        className="min-h-screen bg-white flex flex-col"
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 pb-4">
          <div className="max-w-3xl mx-auto w-full">
            <div className="mb-8">
              <p className="text-slate-500 text-sm font-avenir">Chapter {chapter.number}: {chapter.title}</p>
            </div>
            {page.image_url && (
              <button
                onClick={() => setChromeVisible((v) => !v)}
                className="mb-8 block w-full text-left"
                aria-label="Toggle reading chrome"
              >
                <img src={page.image_url} alt={page.image_caption || 'Chapter image'} className="w-full rounded-lg shadow-md" />
                {page.image_caption && <p className="text-sm text-slate-600 mt-2 italic font-lora">{page.image_caption}</p>}
              </button>
            )}
            {page.subtitle && <h3 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">{page.subtitle}</h3>}
            {page.quote && (
              <blockquote className="text-xl font-lora italic text-slate-700 mb-8 pl-6 border-l-4 border-slate-300 leading-body-relaxed quote-tracking">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(page.quote) as string }} />
                {page.quote_attribute && <footer className="text-base text-slate-600 mt-4 not-italic">— {page.quote_attribute}</footer>}
              </blockquote>
            )}
            {page.content && (
              <div className="markdown-body font-lora text-slate-800 mb-6 leading-body-relaxed body-tracking" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            )}
          </div>
        </div>

        <AnimatePresence>
          {chromeVisible && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25 }}
              className="border-t border-slate-200 bg-white px-6 pt-3 pb-5"
            >
              <div className="flex justify-center gap-1.5 mb-3">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-[3px] rounded-full transition-all ${
                      i === pageNumber - 1 ? 'w-6 bg-slate-800' : 'w-2.5 bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between items-center max-w-3xl mx-auto">
                <button onClick={handlePreviousClick} className="px-4 py-2 font-avenir text-sm text-slate-600 hover:text-slate-800 transition-colors">← Previous</button>
                <button onClick={handleNextClick} className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir text-sm hover:bg-slate-900 transition-colors">Next →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // DESKTOP SPLIT SCREEN — unchanged.
  // Left panel: page.image_url (Glide answer photo) or first gallery
  // item as fallback. Right panel: prose + inline images only.
  return (
    <div className="fixed inset-0 flex bg-white">
      <div className="w-[45%] h-screen flex flex-col bg-white overflow-hidden relative">
        <div className="h-full flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {page.image_url ? (
              <motion.div
                key={`image-${pageNumber}`}
                initial={{ x: slideDirection === 'left' ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection === 'left' ? -300 : 300, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="w-full h-full flex flex-col items-center justify-center p-8"
              >
                <div className="relative w-full flex-1 min-h-0">
                  <img src={page.image_url} alt={page.image_caption || 'Chapter image'} className="absolute inset-0 w-full h-full object-contain" />
                </div>
                {page.image_caption && (
                  <p className="max-w-md text-sm text-slate-600 mt-4 italic font-lora text-center shrink-0">{page.image_caption}</p>
                )}
              </motion.div>
            ) : pageImages.length > 0 ? (
              // Fallback: first gallery item fills left panel when no page.image_url
              <motion.div
                key={`gallery-${pageNumber}`}
                initial={{ x: slideDirection === 'left' ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection === 'left' ? -300 : 300, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="w-full h-full flex flex-col items-center justify-center p-8"
              >
                <div className="relative w-full flex-1 min-h-0">
                  <img src={pageImages[0].image_url} alt={pageImages[0].image_caption || ''} className="absolute inset-0 w-full h-full object-contain" />
                </div>
                {pageImages[0].image_caption && (
                  <p className="max-w-md text-sm text-slate-600 mt-4 italic font-lora text-center shrink-0">{pageImages[0].image_caption}</p>
                )}
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
                <h2 className="text-5xl font-avenir text-white text-center leading-tight">{page.subtitle}</h2>
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${pageNumber}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex items-center justify-center"
              >
                <div className="text-slate-400 text-lg font-avenir">No visual content</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-[55%] h-screen flex flex-col relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 flex flex-col" style={{ paddingBottom: '160px' }}>
          <div className="max-w-2xl mx-auto w-full" style={{ marginTop: 'max(20vh, 60px)' }}>
            {page.subtitle && <h3 className="text-2xl font-avenir text-slate-800 mb-6 heading-tracking">{page.subtitle}</h3>}
            {page.quote && (
              <blockquote className="text-xl font-lora italic text-slate-700 mb-8 pl-6 border-l-4 border-slate-300 leading-body-relaxed quote-tracking">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(page.quote) as string }} />
                {page.quote_attribute && <footer className="text-base text-slate-600 mt-4 not-italic">— {page.quote_attribute}</footer>}
              </blockquote>
            )}
            {page.content && (
              <div className="markdown-body font-lora text-slate-800 mb-6 leading-body-relaxed body-tracking" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            )}
            {/* Gallery items for non-gallery pages are NOT rendered here.
                They remain in Supabase and the Photo Library. */}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-8 pt-4 pb-6">
          <div className="max-w-2xl mx-auto mb-2">
            <p className="text-slate-400 text-xs font-avenir">
              Chapter {chapter.number}: {chapter.title}
              {chapter.lede && <span className="italic"> — {chapter.lede}</span>}
            </p>
          </div>
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            <button onClick={handlePreviousClick} className="px-6 py-2 font-avenir text-slate-600 hover:text-slate-800 transition-colors">← Previous</button>
            <span className="text-slate-500 text-sm font-avenir">Page {pageNumber} of {totalPages}</span>
            <button onClick={handleNextClick} className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
