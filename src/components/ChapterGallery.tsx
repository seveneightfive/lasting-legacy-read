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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800 font-avenir">Gallery</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Story
            </button>
            {onNext && (
              <button
                onClick={onNext}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {galleryItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-600 text-lg font-avenir">No gallery items available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="w-full h-64 object-contain bg-slate-100"
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