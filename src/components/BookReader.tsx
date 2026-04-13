import React, { useState, useEffect, useRef } from 'react';
import { supabase, Book, Chapter, Page, GalleryItem, GuestbookEntry } from '../lib/supabase';
import BookCover from './BookCover';
import BookDedication from './BookDedication';
import BookIntro from './BookIntro';
import ChapterTitle from './ChapterTitle';
import ChapterReader from './ChapterReader';
import ChapterGallery from './ChapterGallery';
import ChapterSpecificGallery from './ChapterSpecificGallery';
import NavigationMenu from './NavigationMenu';
import Guestbook from './Guestbook';
import ThankYouPage from './ThankYouPage';
import McFarlandPopup1 from './McFarlandPopup1';
import McFarlandPopup2 from './McFarlandPopup2';
import { useMcFarlandPopups } from '../hooks/useMcFarlandPopups';

interface BookReaderProps {
  book: Book;
  chapters: Chapter[];
}

type ReadingState =
  | 'cover'
  | 'dedication'
  | 'intro'
  | 'chapter-title'
  | 'chapter-content'
  | 'chapter-gallery'
  | 'gallery'
  | 'guestbook'
  | 'thank-you';

// Slug for Kay's own book — popups won't show there
const KAY_MCFARLAND_SLUG = 'kay-mcfarland';

// Page at which popup 1 triggers (2nd content page seen)
const POPUP1_TRIGGER_PAGE = 2;

export default function BookReader({ book, chapters }: BookReaderProps) {
  const [currentState, setCurrentState] = useState<ReadingState>('cover');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [chapterGalleryItems, setChapterGalleryItems] = useState<GalleryItem[]>([]);
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Track total pages seen across the whole session for popup timing
  const [globalPageCount, setGlobalPageCount] = useState(0);

  const currentChapter = chapters[currentChapterIndex];
  const isAtEnd = currentState === 'guestbook' || currentState === 'thank-you';
  const isKayMcFarlandBook = book.slug === KAY_MCFARLAND_SLUG || book.user === KAY_MCFARLAND_SLUG;

  const { showPopup1, showPopup2, dismissPopup1, dismissPopup2 } = useMcFarlandPopups({
    globalPageCount,
    isAtEnd,
    isKayMcFarlandBook,
  });

  // ── Increment global page counter whenever the reader advances ──
  const incrementPageCount = () => setGlobalPageCount(n => n + 1);

  useEffect(() => {
    if (currentState === 'chapter-content' && currentChapter) {
      fetchPages(currentChapter.id);
    }
  }, [currentState, currentChapter]);

  useEffect(() => {
    if (currentState === 'gallery' && chapters.length > 0) {
      fetchGalleryItems();
    }
  }, [currentState, chapters]);

  useEffect(() => {
    if (currentState === 'guestbook' && book.user) {
      fetchGuestbookEntries();
    }
  }, [currentState, book.user]);

  const fetchPages = async (chapterId: number) => {
    setLoading(true);
    try {
      const [pagesResult, galleryResult] = await Promise.all([
        supabase
          .from('pages')
          .select('*')
          .eq('chapter_id', chapterId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('gallery')
          .select('*')
          .eq('chapter_id', chapterId)
          .order('sort_order', { ascending: true }),
      ]);
      if (pagesResult.error) throw pagesResult.error;
      setPages(pagesResult.data || []);
      setChapterGalleryItems(galleryResult.data || []);
      setCurrentPageIndex(0);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGalleryItems = async () => {
    setLoading(true);
    try {
      const chapterIds = chapters.map(ch => ch.id);
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setGalleryItems(data || []);
    } catch (error) {
      console.error('Error fetching gallery items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapterGalleryItems = async (chapterId: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setChapterGalleryItems(data || []);
    } catch (error) {
      console.error('Error fetching chapter gallery items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuestbookEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guestbook')
        .select('*')
        .eq('user', book.user)
        .neq('private', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGuestbookEntries(data || []);
    } catch (error) {
      console.error('Error fetching guestbook entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkChapterHasGallery = async (chapterId: number): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from('gallery')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', chapterId);
      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      console.error('Error checking chapter gallery:', error);
      return false;
    }
  };

  const handleNext = async () => {
    incrementPageCount();

    switch (currentState) {
      case 'cover':
        if (book.dedication) setCurrentState('dedication');
        else if (book.intro) setCurrentState('intro');
        else if (chapters.length > 0) setCurrentState('chapter-title');
        break;

      case 'dedication':
        if (book.intro) setCurrentState('intro');
        else if (chapters.length > 0) setCurrentState('chapter-title');
        break;

      case 'intro':
        if (chapters.length > 0) setCurrentState('chapter-title');
        break;

      case 'chapter-title':
        setCurrentState('chapter-content');
        break;

      case 'chapter-content':
        if (currentPageIndex < pages.length - 1) {
          setCurrentPageIndex(currentPageIndex + 1);
        } else {
          const hasGallery = await checkChapterHasGallery(currentChapter.id);
          if (hasGallery) {
            fetchChapterGalleryItems(currentChapter.id);
            setCurrentState('chapter-gallery');
          } else if (currentChapterIndex < chapters.length - 1) {
            setCurrentChapterIndex(currentChapterIndex + 1);
            setCurrentState('chapter-title');
          } else {
            setCurrentState('gallery');
          }
        }
        break;

      case 'chapter-gallery':
        if (currentChapterIndex < chapters.length - 1) {
          setCurrentChapterIndex(currentChapterIndex + 1);
          setCurrentState('chapter-title');
        } else {
          setCurrentState('gallery');
        }
        break;

      case 'gallery':
        setCurrentState('guestbook');
        break;

      case 'guestbook':
        setCurrentState('thank-you');
        break;

      case 'thank-you':
        break;
    }
  };

  const handlePrevious = async () => {
    switch (currentState) {
      case 'dedication':
        setCurrentState('cover');
        break;

      case 'intro':
        if (book.dedication) setCurrentState('dedication');
        else setCurrentState('cover');
        break;

      case 'chapter-title':
        if (currentChapterIndex > 0) {
          const previousChapterIndex = currentChapterIndex - 1;
          const previousChapterId = chapters[previousChapterIndex].id;
          const hasGallery = await checkChapterHasGallery(previousChapterId);
          setCurrentChapterIndex(previousChapterIndex);
          if (hasGallery) {
            fetchChapterGalleryItems(previousChapterId);
            setCurrentState('chapter-gallery');
          } else {
            setCurrentState('chapter-content');
          }
        } else if (book.intro) setCurrentState('intro');
        else if (book.dedication) setCurrentState('dedication');
        else setCurrentState('cover');
        break;

      case 'chapter-content':
        if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
        else setCurrentState('chapter-title');
        break;

      case 'chapter-gallery':
        setCurrentPageIndex(pages.length - 1);
        setCurrentState('chapter-content');
        break;

      case 'gallery':
        if (chapters.length > 0) {
          const lastChapterIndex = chapters.length - 1;
          const lastChapterId = chapters[lastChapterIndex].id;
          const hasGallery = await checkChapterHasGallery(lastChapterId);
          setCurrentChapterIndex(lastChapterIndex);
          if (hasGallery) {
            fetchChapterGalleryItems(lastChapterId);
            setCurrentState('chapter-gallery');
          } else {
            setCurrentState('chapter-content');
          }
        }
        break;

      case 'thank-you':
        setCurrentState('guestbook');
        break;

      case 'guestbook':
        setCurrentState('gallery');
        break;
    }
  };

  const handleNavigateToChapter = (index: number) => {
    setCurrentChapterIndex(index);
    setCurrentState('chapter-title');
  };

  const handleNavigateToGallery = () => setCurrentState('gallery');
  const handleNavigateToGuestbook = () => setCurrentState('guestbook');

  // Navigate to Kay's book when user clicks the CTA
  const handleGoToKayStory = () => {
    window.location.href = '/book/kay-mcfarland';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-avenir text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationMenu
        book={book}
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        currentState={currentState}
        onNavigateToChapter={handleNavigateToChapter}
        onNavigateToGallery={handleNavigateToGallery}
        onNavigateToGuestbook={handleNavigateToGuestbook}
      />

      {currentState === 'cover' && <BookCover book={book} onNext={handleNext} />}

      {currentState === 'dedication' && book.dedication && (
        <BookDedication
          book={book}
          dedication={book.dedication}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}

      {currentState === 'intro' && book.intro && (
        <BookIntro intro={book.intro} onNext={handleNext} onPrevious={handlePrevious} />
      )}

      {currentState === 'chapter-title' && currentChapter && (
        <ChapterTitle chapter={currentChapter} onNext={handleNext} onPrevious={handlePrevious} />
      )}

      {currentState === 'chapter-content' && currentChapter && pages.length > 0 && (
        <ChapterReader
          chapter={currentChapter}
          page={pages[currentPageIndex]}
          pageNumber={currentPageIndex + 1}
          totalPages={pages.length}
          galleryItems={chapterGalleryItems}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}

      {currentState === 'chapter-gallery' && currentChapter && (
        <ChapterSpecificGallery
          chapter={currentChapter}
          galleryItems={chapterGalleryItems}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}

      {currentState === 'gallery' && (
        <ChapterGallery galleryItems={galleryItems} onPrevious={handlePrevious} onNext={handleNext} />
      )}

      {currentState === 'guestbook' && (
        <Guestbook
          book={book}
          entries={guestbookEntries}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}

      {currentState === 'thank-you' && (
        <ThankYouPage book={book} onPrevious={handlePrevious} />
      )}

      {/* ── McFarland Popup 1: subtle bottom banner, mid-reading ── */}
      {showPopup1 && (
        <McFarlandPopup1
          onClose={dismissPopup1}
          onLearnMore={() => {
            dismissPopup1();
            handleGoToKayStory();
          }}
        />
      )}

      {/* ── McFarland Popup 2: full modal, end of book ── */}
      {showPopup2 && (
        <McFarlandPopup2
          onClose={dismissPopup2}
          onReadStory={() => {
            dismissPopup2();
            handleGoToKayStory();
          }}
        />
      )}
    </div>
  );
}
