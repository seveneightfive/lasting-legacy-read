import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Book } from '../lib/supabase';

interface BookCoverProps {
  book: Book;
  onNext: () => void;
  /** CSS `background` value (color or gradient) the flip should land on,
   * matching whatever screen comes next. Defaults to the dark gradient
   * used by BookDedication's right panel, since most books have a dedication. */
  nextBackground?: string;
}

export default function BookCover({
  book,
  onNext,
  nextBackground = 'linear-gradient(to bottom right, #0f172a, #334155)',
}: BookCoverProps) {
  const [isTurning, setIsTurning] = useState(false);

  const handleBeginReading = () => {
    if (isTurning) return;
    setIsTurning(true);
    setTimeout(() => {
      onNext();
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col md:flex-row"
    >
      {/* Left page: full-bleed cover image, static throughout */}
      <div className="relative w-full h-[45vh] md:h-screen md:w-1/2">
        {book.image_url && (
          <motion.img
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            src={book.image_url}
            alt={`Cover of ${book.title}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="hidden md:block absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
      </div>

      {/* Right page: flips to hand off into whatever screen comes next */}
      <div
        className="relative w-full flex-1 md:w-1/2 md:h-screen"
        style={{ perspective: 2200 }}
      >
        <motion.div
          className="absolute inset-0 origin-left"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isTurning ? -175 : 0 }}
          transition={{ duration: 0.95, ease: [0.65, 0, 0.35, 1] }}
        >
          {/* Front face: title / author / begin reading */}
          <div
            className="absolute inset-0 flex items-center justify-center px-8 md:px-16 bg-gradient-to-br from-slate-900 to-slate-700"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-center max-w-md"
            >
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

          {/* Back face: matches the next screen's right-side color/gradient for a seamless handoff */}
          <div
            className="absolute inset-0"
            style={{
              background: nextBackground,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
