import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, SquarePen as PenSquare } from 'lucide-react';
import { Book } from '../lib/supabase';

interface ThankYouPageProps {
  book: Book;
  onPrevious: () => void;
}

export default function ThankYouPage({ book, onPrevious }: ThankYouPageProps) {
  const handleGuestbookClick = () => {
    if (book.filloutform_link) {
      window.open(book.filloutform_link, '_blank', 'noopener,noreferrer');
    }
  };

  const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/site-images/LLO-SiteLogo.png`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl w-full text-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8"
        >
          <img
            src={logoUrl}
            alt="Lasting Legacy Online Logo"
            className="w-full max-w-md mx-auto mb-12"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-4xl md:text-5xl font-avenir font-bold text-slate-800 mb-6 leading-tight"
        >
          Thank you for reading my
          <br />
          Lasting Legacy Online Story
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-xl md:text-2xl text-slate-600 font-avenir mb-10"
        >
          Please let me know you were here.
        </motion.p>

        {book.filloutform_link && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            onClick={handleGuestbookClick}
            className="inline-flex items-center gap-3 px-8 py-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all hover:shadow-lg transform hover:scale-105 font-avenir font-semibold text-lg"
          >
            <PenSquare className="w-6 h-6" />
            Sign My Guestbook
          </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          onClick={onPrevious}
          className="mt-12 flex items-center gap-2 mx-auto text-slate-600 hover:text-slate-800 transition-colors font-avenir"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gallery
        </motion.button>
      </motion.div>
    </div>
  );
}
