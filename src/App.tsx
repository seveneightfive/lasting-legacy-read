import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { Book, GuestbookEntry } from './lib/supabase';
import { fetchBookReader, ChapterWithReaderData } from './lib/fetchBookReader';
import BookReader from './components/BookReader';
import EditorPage from './components/editor/EditorPage';

const TRACK_URL = 'https://uhzncrsbytxwdlmldwqf.supabase.co/functions/v1/track-story-view';

// Fire-and-forget — never blocks the reading experience
async function trackView(slug: string): Promise<void> {
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
  } catch {
    // Silent fail
  }
}

function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterWithReaderData[]>([]);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadBook(slug);
    }
  }, [slug]);

  const loadBook = async (bookSlug: string) => {
    try {
      setLoading(true);
      setError(null);

      const payload = await fetchBookReader(bookSlug);

      if (!payload) {
        setBook(null);
        setChapters([]);
        setGuestbook([]);
        return;
      }

      const bookData: Book = {
        id: payload.id,
        title: payload.title,
        author: payload.author,
        slug: payload.slug,
        image_url: payload.cover_image_url ?? undefined,
        dedication: payload.dedication ?? undefined,
        intro: payload.intro ?? undefined,
        intro_image_url: payload.intro_image_url,
        intro_image_caption: payload.intro_image_caption,
        filloutform_link: payload.filloutform_link ?? undefined,
      };

      // Drop chapters with no pages — same filter App.tsx used to do
      // with N separate count() queries, now just an array filter
      // since every chapter's pages already came down in the payload.
      const chaptersWithPages = (payload.chapters ?? [])
        .filter((c) => (c.pages?.length ?? 0) > 0);

      setBook(bookData);
      setChapters(chaptersWithPages);
      setGuestbook(payload.guestbook ?? []);
      trackView(bookSlug);
    } catch (err) {
      console.error('Error fetching book:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-avenir text-lg">Loading book...</div>
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

  return <BookReader book={book} chapters={chapters} initialGuestbook={guestbook} />;
}

function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-avenir text-slate-800 mb-4">Book Reader</h1>
        <p className="text-slate-600">Navigate to /book/lasting-legacy-online to read the book</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/book/:slug" element={<BookPage />} />
        <Route path="/book/:slug/edit" element={<EditorPage />} />
      </Routes>
    </Router>
  );
}
