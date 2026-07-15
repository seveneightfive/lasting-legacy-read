import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '../lib/supabase';

interface BookCoverProps {
  book: Book;
  onNext: () => void;
}

export default function BookCover({ book, onNext }: BookCoverProps) {
  const [isTurning, setIsTurning] = useState(false);

  const handleBeginReading = () => {
    if (isTurning) return;
    setIsTurning(true);
    // Call onNext right as the flip finishes covering the screen,
    // so the dedication page is already mounted underneath by the time it's revealed.
    setTimeout(() => {
      onNext();
    }, 850);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 relative overflow-hidden"
      style={{ perspective: 2000 }}
    >
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Left column: image + title + button, vertically centered as a group */}
        <div className="w-full md:w-1/2 h-screen flex items-center justify-center px-8 md:px-16">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex flex-col items-center text-center max-w-md"
          >
            {book.image_url && (
              <div className="mb-8" style={{ height: '50vh' }}>
                <img
                  src={book.image_url}
                  alt={`Cover of ${book.title}`}
                  className="h-full w-auto object-cover rounded-lg shadow-2xl mx-auto"
                />
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-avenir text-white mb-4 heading-tracking">
              {book.title}
            </h1>

            <p className="text-lg md:text-xl font-lora text-slate-300 mb-8">
              by {book.author}
            </p>

            <motion.button
              onClick={handleBeginReading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isTurning}
              className="px-8 py-4 bg-white text-slate-900 rounded-full font-avenir text-lg hover:bg-slate-100 transition-colors shadow-lg disabled:opacity-70"
            >
              Begin Reading →
            </motion.button>
          </motion.div>
        </div>

        {/* Right column: open space (decorative, keeps the left column from centering full-width) */}
        <div className="hidden md:block w-1/2 h-screen" />
      </div>

      {/* Page-turn overlay: right half flips around the screen's center like a spine */}
      <AnimatePresence>
        {isTurning && (
          <motion.div
            className="absolute top-0 right-0 h-full w-1/2 origin-left"
            style={{ transformStyle: 'preserve-3d', zIndex: 50 }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -180 }}
            transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* Front face: matches the cover so the flip looks continuous */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-700"
              style={{
                backfaceVisibility: 'hidden',
                boxShadow: 'inset -30px 0 50px rgba(0,0,0,0.45)',
              }}
            />
            {/* Back face: the underside of the page as it lands, softening into the dedication page */}
            <div
              className="absolute inset-0 bg-[#f8f5ee]"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                boxShadow: 'inset 30px 0 50px rgba(0,0,0,0.12)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
