import React from 'react';
import { motion } from 'framer-motion';
import { Chapter } from '../lib/supabase';

interface ChapterTitleProps {
  chapter: Chapter;
  onNext: () => void;
  onPrevious: () => void;
}

export default function ChapterTitle({ chapter, onNext, onPrevious }: ChapterTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex items-center justify-center p-8 relative"
      style={{
        backgroundColor: chapter.image_url ? 'transparent' : '#1e293b'
      }}
    >
      {chapter.image_url && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${chapter.image_url})`,
            }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}

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
              onClick={onNext}
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
