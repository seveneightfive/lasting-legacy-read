import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, PenLine } from 'lucide-react';
import { Book, supabase } from '../lib/supabase';

interface GuestbookSignModalProps {
  open: boolean;
  book: Book;
  onClose: () => void;
  onEntryAdded?: () => void;
}

// Popup version of the "Sign the Guestbook" form. Lives on top of whatever
// screen triggered it (Thank You page, nav menu, etc.) so a reader never has
// to leave what they're looking at just to leave a message.
export default function GuestbookSignModal({ open, book, onClose, onEntryAdded }: GuestbookSignModalProps) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const reset = () => {
    setGuestName('');
    setGuestEmail('');
    setMessage('');
    setIsPrivate(false);
    setStatus('idle');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim() || !message.trim()) return;

    setStatus('saving');

    const { error } = await supabase.from('guestbook').insert({
      book_id: book.id,
      author_email: book.user ?? '',
      guest: guestName.trim(),
      guest_email: guestEmail.trim(),
      message: message.trim(),
      private: isPrivate,
    });

    if (error) {
      console.error('Guestbook insert failed:', error.message);
      setStatus('error');
      return;
    }

    setStatus('saved');
    onEntryAdded?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              style={{ pointerEvents: 'all' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                <h2 className="text-xl font-avenir font-semibold text-slate-800">
                  Sign the Guestbook
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {status === 'saved' ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-6"
                  >
                    <p className="text-slate-800 font-avenir text-lg font-semibold mb-2">
                      Thank you for signing!
                    </p>
                    <p className="text-slate-500 font-avenir text-sm mb-6">
                      Your message has been added to {book.author}'s guestbook.
                    </p>
                    <button
                      onClick={handleClose}
                      className="px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir text-sm"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <p className="text-sm text-slate-600 font-avenir mb-5">
                      Leave a message for {book.author}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">
                          Your name
                        </label>
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          required
                          placeholder="Jane Smith"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-avenir text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">
                          Your email
                        </label>
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          required
                          placeholder="jane@example.com"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-avenir text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                        <p className="text-xs text-slate-400 font-avenir mt-1">
                          Only visible to the author — never shown publicly.
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">
                        Your message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={4}
                        placeholder={`Share your thoughts about ${book.author}'s story…`}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-avenir text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-5">
                      <input
                        id="private-check-modal"
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                      />
                      <label
                        htmlFor="private-check-modal"
                        className="flex items-center gap-1.5 text-sm text-slate-600 font-avenir cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Keep this message private (only the author will see it)
                      </label>
                    </div>

                    {status === 'error' && (
                      <p className="text-red-600 text-sm font-avenir mb-4">
                        Something went wrong. Please try again.
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={status === 'saving'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir text-sm disabled:opacity-60"
                      >
                        <PenLine className="w-4 h-4" />
                        {status === 'saving' ? 'Sending…' : 'Sign Guestbook'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-avenir text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
