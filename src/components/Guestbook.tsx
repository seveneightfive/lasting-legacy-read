import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, PenLine, Lock } from 'lucide-react';
import { GuestbookEntry, Book, supabase } from '../lib/supabase';

interface GuestbookProps {
  book: Book;
  entries: GuestbookEntry[];
  onPrevious: () => void;
  onNext: () => void;
  onEntryAdded?: () => void;
}

export default function Guestbook({ book, entries, onPrevious, onNext, onEntryAdded }: GuestbookProps) {
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim() || !message.trim()) return;

    setStatus('saving');

    const { error } = await supabase.from('guestbook').insert({
      book_id: book.id,
      author_email: book.user ?? '',   // book owner's email, denormalized for Glide filtering
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
    setGuestName('');
    setGuestEmail('');
    setMessage('');
    setIsPrivate(false);
    setShowForm(false);
    onEntryAdded?.();
  };

  const publicEntries = entries.filter(e => !e.private);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-slate-700" />
            <h1 className="text-4xl font-bold text-slate-600 font-avenir">Guestbook</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-avenir"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
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

        {/* Sign button / success message */}
        <div className="mb-8">
          {status === 'saved' ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-5 py-4 font-avenir text-sm"
            >
              Thank you for signing the guestbook! Your message has been added.
            </motion.div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir"
            >
              <PenLine className="w-4 h-4" />
              Sign the Guestbook
            </button>
          ) : null}
        </div>

        {/* Sign form */}
        <AnimatePresence>
          {showForm && status !== 'saved' && (
            <motion.form
              key="guestbook-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-10 overflow-hidden"
            >
              <h2 className="text-xl font-semibold text-slate-700 font-avenir mb-5">
                Leave a message for {book.author}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">Your name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-avenir text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">Your email</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
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
                <label className="block text-sm font-medium text-slate-600 font-avenir mb-1">Your message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder={`Share your thoughts about ${book.author}'s story…`}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-avenir text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 mb-5">
                <input
                  id="private-check"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={e => setIsPrivate(e.target.checked)}
                  className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                />
                <label htmlFor="private-check" className="flex items-center gap-1.5 text-sm text-slate-600 font-avenir cursor-pointer">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Keep this message private (only the author will see it)
                </label>
              </div>

              {status === 'error' && (
                <p className="text-red-600 text-sm font-avenir mb-4">Something went wrong. Please try again.</p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={status === 'saving'}
                  className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-avenir text-sm disabled:opacity-60"
                >
                  {status === 'saving' ? 'Sending…' : 'Sign Guestbook'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setStatus('idle'); }}
                  className="px-5 py-2 text-slate-600 hover:text-slate-800 font-avenir text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Entry list — public only */}
        {publicEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-20"
          >
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <p className="text-slate-500 text-xl font-avenir">Be the first to sign!</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {publicEntries.map((entry, index) => (
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
                    <p className="text-slate-900 font-semibold font-avenir text-sm">{entry.guest}</p>
                    {entry.created_at && (
                      <p className="text-slate-500 text-xs font-avenir mt-1">{formatDate(entry.created_at)}</p>
                    )}
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
            {publicEntries.length} {publicEntries.length === 1 ? 'entry' : 'entries'} in the guestbook
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
