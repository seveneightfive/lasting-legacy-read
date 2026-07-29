import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryItem } from '../lib/supabase';

interface ChapterGalleryProps {
  galleryItems: GalleryItem[];
  onPrevious: () => void;
  onNext?: () => void;
}

export default function ChapterGallery({ galleryItems, onPrevious, onNext }: ChapterGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goToPrevious = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
  };

  const goToNext = () => {
    if (lightboxIndex !== null && lightboxIndex < galleryItems.length - 1)
      setLightboxIndex(lightboxIndex + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 font-avenir tracking-tight">Gallery</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-avenir text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Story
            </button>
            {onNext && (
              <button
                onClick={onNext}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir text-sm"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Masonry grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {galleryItems.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-400 text-lg font-avenir">No photos yet.</p>
          </div>
        ) : (
          <div
            style={{
              columns: 'var(--gallery-cols, 3)',
              columnGap: '1rem',
            }}
            className="[--gallery-cols:2] sm:[--gallery-cols:2] lg:[--gallery-cols:3] xl:[--gallery-cols:4]"
          >
            {galleryItems.map((item, index) => {
              const hasCaption = item.image_title || item.image_caption;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.6) }}
                  className="break-inside-avoid mb-4 group relative cursor-pointer rounded-lg overflow-hidden"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={item.image_url}
                    alt={item.image_title || item.image_caption || 'Gallery photo'}
                    className="w-full h-auto block"
                    loading="lazy"
                  />

                  {/* Caption overlay — slides up on hover */}
                  {hasCaption && (
                    <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-gradient-to-t from-black/80 via-black/60 to-transparent px-4 pt-8 pb-4">
                      {item.image_title && (
                        <p className="text-white text-sm font-semibold font-avenir leading-snug">
                          {item.image_title}
                        </p>
                      )}
                      {item.image_caption && (
                        <p className="text-slate-300 text-xs font-avenir mt-0.5 leading-snug">
                          {item.image_caption}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 rounded-lg" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox — unchanged, captions shown below image */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            >
              <X className="w-7 h-7" />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors z-10"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
            )}

            {lightboxIndex < galleryItems.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors z-10"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            )}

            <div
              className="max-w-5xl w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                src={galleryItems[lightboxIndex].image_url}
                alt={galleryItems[lightboxIndex].image_title || 'Gallery image'}
                className="max-h-[78vh] w-auto object-contain rounded"
              />

              {(galleryItems[lightboxIndex].image_title || galleryItems[lightboxIndex].image_caption) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-5 text-center max-w-xl px-4"
                >
                  {galleryItems[lightboxIndex].image_title && (
                    <p className="text-white font-semibold font-avenir text-base leading-snug">
                      {galleryItems[lightboxIndex].image_title}
                    </p>
                  )}
                  {galleryItems[lightboxIndex].image_caption && (
                    <p className="text-slate-400 font-avenir text-sm mt-1 leading-snug">
                      {galleryItems[lightboxIndex].image_caption}
                    </p>
                  )}
                </motion.div>
              )}

              <p className="text-slate-600 text-xs mt-4 font-avenir">
                {lightboxIndex + 1} / {galleryItems.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
