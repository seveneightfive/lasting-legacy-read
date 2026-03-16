import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { GuestbookEntry, Book } from '../lib/supabase';

interface GuestbookProps {
  book: Book;
  entries: GuestbookEntry[];
  onPrevious: () => void;
  onNext: () => void;
}

export default function Guestbook({ book, entries, onPrevious, onNext }: GuestbookProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-slate-700" />
            <h1 className="text-4xl font-bold text-slate-800 font-avenir">Guestbook</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-avenir"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Gallery
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-20"
          >
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <p className="text-slate-500 text-xl font-avenir">
              No guestbook entries yet.{' '}
              {book.filloutform_link ? (
                <a
                  href={book.filloutform_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-slate-900 underline transition-colors"
                >
                  Be the first to sign!
                </a>
              ) : (
                'Be the first to sign!'
              )}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border-l-4 border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-slate-700 text-lg font-avenir leading-relaxed whitespace-pre-wrap">
                      {entry.message}
                    </p>
                  </div>
                  <div className="flex flex-col items-end text-right flex-shrink-0">
                    <p className="text-slate-900 font-semibold font-avenir text-sm">
                      {entry.guest}
                    </p>
                    <p className="text-slate-500 text-xs font-avenir mt-1">
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-slate-600 font-avenir text-sm">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in the guestbook
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
