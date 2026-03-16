import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { supabase, Book, Chapter } from './lib/supabase';
import BookReader from './components/BookReader';

function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchBookAndChapters(slug);
    }
  }, [slug]);

  const fetchBookAndChapters = async (bookSlug: string) => {
    try {
      setLoading(true);
      console.log('Fetching book with slug:', bookSlug);

      // Fetch book
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('slug', bookSlug)
        .maybeSingle();

      if (bookError) {
        console.error('Book fetch error:', bookError);
        throw bookError;
      }

      if (!bookData) {
        console.log('Book not found for slug:', bookSlug);
        setBook(null);
        setChapters([]);
        return;
      }

      console.log('Book data:', bookData);
      setBook(bookData);

      // Fetch chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookData.id)
        .order('number', { ascending: true });

      if (chaptersError) {
        console.error('Chapters fetch error:', chaptersError);
        throw chaptersError;
      }

      console.log('Chapters data:', chaptersData);

      // Filter chapters to only include those with at least one page
      const chaptersWithPages = await Promise.all(
        (chaptersData || []).map(async (chapter) => {
          const { count } = await supabase
            .from('pages')
            .select('*', { count: 'exact', head: true })
            .eq('chapter_id', chapter.id);

          return { chapter, hasPages: (count || 0) > 0 };
        })
      );

      const filteredChapters = chaptersWithPages
        .filter(({ hasPages }) => hasPages)
        .map(({ chapter }) => chapter);

      console.log('Filtered chapters with pages:', filteredChapters);
      setChapters(filteredChapters);

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

  return <BookReader book={book} chapters={chapters} />;
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
      </Routes>
    </Router>
  );
}