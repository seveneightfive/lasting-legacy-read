import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, Book, Chapter } from '../../lib/supabase';
import PinGate from './PinGate';
import BookEditor from './BookEditor';

const SESSION_KEY_PREFIX = 'lle.editPin.';

export default function EditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        // Load book
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (bookError) throw bookError;
        if (!bookData) {
          if (!cancelled) {
            setBook(null);
            setLoading(false);
          }
          return;
        }

        // Load chapters (no page filtering — editor shows all chapters)
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('book_id', bookData.id)
          .order('number', { ascending: true });

        if (chaptersError) throw chaptersError;

        if (!cancelled) {
          setBook(bookData);
          setChapters(chaptersData || []);

          // Check if a valid pin is already stored for this slug in this session
          const stored = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${slug}`);
          if (stored && bookData.edit_pin && stored === String(bookData.edit_pin)) {
            setEnteredPin(stored);
            setUnlocked(true);
          }
        }
      } catch (err) {
        console.error('Editor load error:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [slug]);

  const handleUnlock = () => {
    if (book?.edit_pin && slug) {
      sessionStorage.setItem(`${SESSION_KEY_PREFIX}${slug}`, String(book.edit_pin));
      setEnteredPin(String(book.edit_pin));
    }
    setUnlocked(true);
  };

  const handleCancel = () => {
    navigate(`/book/${slug}`);
  };

  const handleExit = () => {
    if (slug) sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${slug}`);
    navigate(`/book/${slug}`);
  };

  // ─── Render states ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-avenir text-lg">Loading editor…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-600 font-avenir text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-avenir text-lg">Book not found</div>
      </div>
    );
  }

  if (!book.edit_pin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-avenir text-slate-800 mb-3">Editing not enabled</h1>
          <p className="text-slate-600 font-lora mb-6">
            This story doesn't have an edit code set yet. Please contact the story owner
            or add an <code className="px-1 bg-slate-100 rounded">edit_pin</code> to the
            book in Supabase.
          </p>
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors"
          >
            Back to story
          </button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <PinGate
        bookTitle={book.title}
        expectedPin={String(book.edit_pin)}
        onUnlock={handleUnlock}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <BookEditor
      book={book}
      chapters={chapters}
      pin={enteredPin ?? String(book.edit_pin)}
      onExit={handleExit}
    />
  );
}
