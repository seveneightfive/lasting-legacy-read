import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Chapter } from '../lib/supabase';

interface ChapterTitleProps {
  chapter: Chapter;
  onNext: () => void;
  onPrevious: () => void;
}

export default function ChapterTitle({ chapter, onNext, onPrevious }: ChapterTitleProps) {
  const [isTurning, setIsTurning] = useState(false);

  const handleBeginChapter = () => {
    if (isTurning) return;
    if (!chapter.image_url) {
      onNext();
      return;
    }
    setIsTurning(true);
    setTimeout(() => {
      onNext();
    }, 1000);
  };

  // No image: original centered, full-bleed dark background layout
  if (!chapter.image_url) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen flex items-center justify-center p-8 relative"
        style={{ backgroundColor: '#1e293b' }}
      >
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <p className="text-slate-400 font-avenir text-sm uppercase mb-4 dedication-tracking">
              Chapter {chapter.number}
            </p>
            <h2 className="text-4xl md:text-5xl font-avenir text-white mb-6 heading-tracking">
              {chapter.title}
            </h2>
            {chapter.lede && (
              <p className="text-xl font-lora text-slate-300 mb-12 leading-body-relaxed quote-tracking italic">
                {chapter.lede}
              </p>
            )}
            <div className="flex justify-between items-center mt-12">
              <button
                onClick={onPrevious}
                className="px-6 py-2 font-avenir text-slate-300 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleBeginChapter}
                className="px-8 py-4 bg-white text-slate-900 rounded-full font-avenir hover:bg-slate-100 transition-colors"
              >
                Begin Chapter →
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Has image: split-screen "book" layout, same page-turn as the cover
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-slate-900 flex flex-col md:flex-row"
    >
      {/* Left page: full-bleed chapter image, static throughout */}
      <div className="relative w-full h-[45vh] md:h-screen md:w-1/2">
        <motion.img
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          src={chapter.image_url}
          alt={`Chapter ${chapter.number}: ${chapter.title}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="hidden md:block absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
      </div>

      {/* Right page: flips on Begin Chapter */}
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
          {/* Front face: chapter number / title / lede / nav */}
          <div
            className="absolute inset-0 flex items-center justify-center px-8 md:px-16 bg-slate-900"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-center max-w-md"
            >
              <p className="text-slate-400 font-avenir text-sm uppercase mb-4 dedication-tracking">
                Chapter {chapter.number}
              </p>
              <h2 className="text-4xl md:text-5xl font-avenir text-white mb-6 heading-tracking">
                {chapter.title}
              </h2>
              {chapter.lede && (
                <p className="text-xl font-lora text-slate-300 mb-12 leading-body-relaxed quote-tracking italic">
                  {chapter.lede}
                </p>
              )}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={onPrevious}
                  disabled={isTurning}
                  className="px-6 py-2 font-avenir text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleBeginChapter}
                  disabled={isTurning}
                  className="px-8 py-4 bg-white text-slate-900 rounded-full font-avenir hover:bg-slate-100 transition-colors disabled:opacity-70"
                >
                  Begin Chapter →
                </button>
              </div>
            </motion.div>
          </div>

          {/* Back face: settles into the same dark tone the chapter body opens on */}
          <div
            className="absolute inset-0 bg-slate-900"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
