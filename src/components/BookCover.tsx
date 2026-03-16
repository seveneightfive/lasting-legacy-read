import React from 'react';
import { motion } from 'framer-motion';
import { Book } from '../lib/supabase';

interface BookCoverProps {
  book: Book;
  onNext: () => void;
}

export default function BookCover({ book, onNext }: BookCoverProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-8"
    >
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {book.image_url && (
            <div className="mb-8">
              <img
                src={book.image_url}
                alt={`Cover of ${book.title}`}
                className="w-64 h-96 object-cover rounded-lg shadow-2xl mx-auto"
              />
            </div>
          )}
          
          <h1 className="text-5xl md:text-6xl font-avenir text-white mb-4 heading-tracking">
            {book.title}
          </h1>
          
          <p className="text-xl md:text-2xl font-lora text-slate-300 mb-8">
            by {book.author}
          </p>
          
          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white text-slate-900 rounded-full font-avenir text-lg hover:bg-slate-100 transition-colors shadow-lg"
          >
            Begin Reading →
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}