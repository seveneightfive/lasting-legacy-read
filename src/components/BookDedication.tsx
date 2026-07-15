import React from 'react';
import { motion } from 'framer-motion';
import { Book } from '../lib/supabase';

interface BookDedicationProps {
  book: Book;
  dedication: string | null | undefined;
  onNext: () => void;
  onPrevious: () => void;
}

export default function BookDedication({
  book,
  dedication,
  onNext,
  onPrevious,
}: BookDedicationProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-slate-50 flex flex-col md:flex-row"
    >
      {/* Left page: dedication text */}
      <div className="w-full md:w-1/2 min-h-[60vh] md:h-screen flex items-center justify-center px-8 md:px-16 py-16 md:py-0">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="max-w-md text-center"
        >
          <h2 className="text-2xl md:text-3xl font-avenir text-slate-800 mb-8 heading-tracking">
            Dedication
          </h2>
          <div
            className="font-lora text-lg md:text-xl text-slate-700 leading-relaxed italic mb-12"
            dangerouslySetInnerHTML={{ __html: dedication || '' }}
          />
          <div className="flex items-center justify-center gap-4">
            <motion.button
              onClick={onPrevious}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-full font-avenir hover:bg-slate-100 transition-colors shadow-sm"
            >
              ← Back
            </motion.button>
            <motion.button
              onClick={onNext}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-slate-900 text-white rounded-full font-avenir hover:bg-slate-800 transition-colors shadow-lg"
            >
              Continue →
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Right page: solid dark panel — echoes the cover's flip, hints at pages still ahead */}
      <div className="hidden md:block w-1/2 h-screen bg-gradient-to-br from-slate-900 to-slate-700" />
    </motion.div>
  );
}
