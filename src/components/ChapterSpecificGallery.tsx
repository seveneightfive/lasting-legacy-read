import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryItem, Chapter } from '../lib/supabase';

interface ChapterSpecificGalleryProps {
  chapter: Chapter;
  galleryItems: GalleryItem[];
  onNext: () => void;
  onPrevious: () => void;
}

export default function ChapterSpecificGallery({
  chapter,
  galleryItems,
  onNext,
  onPrevious
}: ChapterSpecificGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const goToPrevious = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  const goToNext = () => {
    if (lightboxIndex !== null && lightboxIndex < galleryItems.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-2 font-avenir">Chapter {chapter.number}</p>
          <h1 className="text-3xl font-bold text-slate-800 font-avenir mb-4">Gallery - {galleryItems.length} {galleryItems.length === 1 ? 'Image' : 'Images'}</h1>
          <p className="text-slate-600 font-avenir">
            Click on any photo to view full size photo gallery
          </p>
        </div>

        {galleryItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-600 text-lg font-avenir mb-8">No gallery items for this chapter.</p>
            <button
              onClick={onNext}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Continue Reading
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {galleryItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={item.image_url}
                    alt={item.image_title || 'Gallery image'}
                    className="w-full h-64 object-cover"
                  />
                  {(item.image_title || item.image_caption) && (
                    <div className="p-4">
                      {item.image_title && (
                        <h3 className="font-semibold text-slate-800 mb-2 font-avenir">
                          {item.image_title}
                        </h3>
                      )}
                      {item.image_caption && (
                        <p className="text-slate-600 text-sm font-avenir">
                          {item.image_caption}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-slate-200">
              <button
                onClick={onPrevious}
                className="px-6 py-3 font-avenir text-slate-600 hover:text-slate-800 transition-colors"
              >
                ← Back to Chapter
              </button>

              <button
                onClick={onNext}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-avenir"
              >
                Continue Reading
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors z-10"
              aria-label="Close lightbox"
            >
              <X className="w-8 h-8" />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-12 h-12" />
              </button>
            )}

            {lightboxIndex < galleryItems.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-12 h-12" />
              </button>
            )}

            <div
              className="max-w-6xl w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                src={galleryItems[lightboxIndex].image_url}
                alt={galleryItems[lightboxIndex].image_title || 'Gallery image'}
                className="max-h-[80vh] w-auto object-contain rounded-lg"
              />

              {(galleryItems[lightboxIndex].image_title || galleryItems[lightboxIndex].image_caption) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 text-center max-w-2xl"
                >
                  {galleryItems[lightboxIndex].image_title && (
                    <h3 className="text-xl font-semibold text-white mb-2 font-avenir">
                      {galleryItems[lightboxIndex].image_title}
                    </h3>
                  )}
                  {galleryItems[lightboxIndex].image_caption && (
                    <p className="text-slate-300 font-avenir">
                      {galleryItems[lightboxIndex].image_caption}
                    </p>
                  )}
                </motion.div>
              )}

              <p className="text-slate-400 text-sm mt-4 font-avenir">
                {lightboxIndex + 1} / {galleryItems.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
