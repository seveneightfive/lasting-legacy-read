import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ExitIntentPopupProps {
  onClose: () => void;
}

const APP_URL = 'https://app.lastinglegacyonline.com';

// Full-screen popup shown once per session when the reader looks like
// they're about to leave the book page. Styled to match ThankYouPage.
export default function ExitIntentPopup({ onClose }: ExitIntentPopupProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[80] bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-7 h-7" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="max-w-2xl w-full text-center"
        >
          <p className="text-sm font-avenir font-bold uppercase tracking-widest text-slate-400 mb-4">
            Now it's your turn
          </p>

          <h1 className="text-4xl md:text-5xl font-avenir font-bold text-slate-800 mb-6 leading-tight">
            Write your Lasting Legacy
            <br />
            Online story today.
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 font-avenir mb-10">
            Free forever. Get started.
          </p>

          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all hover:shadow-lg transform hover:scale-105 font-avenir font-semibold text-lg"
          >
            Get Started →
          </a>

          <div className="mt-10">
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 font-avenir text-sm transition-colors"
            >
              Maybe later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
