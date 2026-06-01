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
import { sortPagesForDisplay } from '../utils/pageOrder';

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

const KAY_MCFARLAND_SLUG = 'kay-mcfarland';
const POPUP1_TRIGGER_PAGE = 2;

function hasContent(field: unknown): boolean {
  if (field == null) return false;
  if (typeof field === 'string') return field.trim().length > 0;
  if (Array.isArray(field)) return field.length > 0;
  if (typeof field === 'object') {
    const doc = field as { content?: unknown[] };
    if (Array.isArray(doc.content)) return doc.content.length > 0;
    return Object.keys(field).length > 0;
  }
  return Boolean(field);
}

export default function BookReader({ book, chapters }: BookReaderProps) {
  const [currentState, setCurrentState] = useState<ReadingState>('cover');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [chapterGalleryItems, setChapterGalleryItems] = useState<GalleryItem[]>([]);

  // Page-level gallery items keyed by page id — used by ChapterReader for gallery pages
  const [pageGalleryItems, setPageGalleryItems] = useState<GalleryItem[]>([]);

  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalPageCount, setGlobalPageCount] = useState(0);

  const currentChapter = chapters[currentChapterIndex];
  const isAtEnd = currentState === 'guestbook' || currentState === 'thank-you';
  const isKayMcFarlandBook = book.slug === KAY_MCFARLAND_SLUG || book.user === KAY_MCFARLAND_SLUG;

  const hasDedication = hasContent(book.dedication);
  const hasIntro = hasContent(book.intro);
  const hasChapters = chapters.length > 0;

  const { showPopup1, showPopup2, dismissPopup1, dismissPopup2 } = useMcFarlandPopups({
    globalPageCount,
    isAtEnd,
    isKayMcFarlandBook,
  });

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
      const [pagesResult, chapterGalleryResult, pageGalleryResult] = await Promise.all([
        supabase
          .from('pages')
          .select('*')
          .eq('chapter_id', chapterId)
          .or('is_deleted.is.null,is_deleted.eq.false'),
        // Floating chapter-level gallery (no page_id) — used by ChapterSpecificGallery
        supabase
          .from('gallery')
          .select('*')
          .eq('chapter_id', chapterId)
          .is('page_id', null)
          .order('sort_order', { ascending: true }),
        // Page-level gallery items — used by ChapterReader (including gallery pages)
        supabase
          .from('gallery')
          .select('*')
          .eq('chapter_id', chapterId)
          .not('page_id', 'is', null)
          .order('sort_order', { ascending: true }),
      ]);

      if (pagesResult.error) throw pagesResult.error;
      setPages(sortPagesForDisplay(pagesResult.data || []));
      setChapterGalleryItems(chapterGalleryResult.data || []);
      setPageGalleryItems(pageGalleryResult.data || []);
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
        .eq('chapter_id', chapterId)
        .is('page_id', null);
      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      console.error('Error checking chapter gallery:', error);
      return false;
    }
  };

  const handleNext = async () => {
    if (currentState === 'cover' && !hasChapters) return;

    let advanced = false;

    switch (currentState) {
      case 'cover':
        if (hasDedication) { setCurrentState('dedication'); advanced = true; }
        else if (hasIntro) { setCurrentState('intro'); advanced = true; }
        else if (hasChapters) { setCurrentState('chapter-title'); advanced = true; }
        break;

      case 'dedication':
        if (hasIntro) { setCurrentState('intro'); advanced = true; }
        else if (hasChapters) { setCurrentState('chapter-title'); advanced = true; }
        break;

      case 'intro':
        if (hasChapters) { setCurrentState('chapter-title'); advanced = true; }
        break;

      case 'chapter-title':
        setCurrentPageIndex(0);
        setCurrentState('chapter-content');
        advanced = true;
        break;

      case 'chapter-content':
        if (currentPageIndex < pages.length - 1) {
          setCurrentPageIndex(currentPageIndex + 1);
          advanced = true;
        } else {
          const chapterHasGallery = await checkChapterHasGallery(currentChapter.id);
          if (chapterHasGallery) {
            fetchChapterGalleryItems(currentChapter.id);
            setCurrentState('chapter-gallery');
            advanced = true;
          } else if (currentChapterIndex < chapters.length - 1) {
            setCurrentChapterIndex(currentChapterIndex + 1);
            setCurrentPageIndex(0);
            setCurrentState('chapter-title');
            advanced = true;
          } else {
            setCurrentState('gallery');
            advanced = true;
          }
        }
        break;

      case 'chapter-gallery':
        if (currentChapterIndex < chapters.length - 1) {
          setCurrentChapterIndex(currentChapterIndex + 1);
          setCurrentPageIndex(0);
          setCurrentState('chapter-title');
          advanced = true;
        } else {
          setCurrentState('gallery');
          advanced = true;
        }
        break;

      case 'gallery':
        setCurrentState('guestbook');
        advanced = true;
        break;

      case 'guestbook':
        setCurrentState('thank-you');
        advanced = true;
        break;

      case 'thank-you':
        break;
    }

    if (advanced) incrementPageCount();
  };

  const handlePrevious = async () => {
    switch (currentState) {
      case 'dedication':
        setCurrentState('cover');
        break;

      case 'intro':
        if (hasDedication) setCurrentState('dedication');
        else setCurrentState('cover');
        break;

      case 'chapter-title':
        if (currentChapterIndex > 0) {
          const previousChapterIndex = currentChapterIndex - 1;
          const previousChapterId = chapters[previousChapterIndex].id;
          const previousHasGallery = await checkChapterHasGallery(previousChapterId);
          setCurrentChapterIndex(previousChapterIndex);
          if (previousHasGallery) {
            fetchChapterGalleryItems(previousChapterId);
            setCurrentState('chapter-gallery');
          } else {
            setCurrentState('chapter-content');
          }
        } else if (hasIntro) {
          setCurrentState('intro');
        } else if (hasDedication) {
          setCurrentState('dedication');
        } else {
          setCurrentState('cover');
        }
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
        if (hasChapters) {
          const lastChapterIndex = chapters.length - 1;
          const lastChapterId = chapters[lastChapterIndex].id;
          const lastHasGallery = await checkChapterHasGallery(lastChapterId);
          setCurrentChapterIndex(lastChapterIndex);
          if (lastHasGallery) {
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
    setCurrentPageIndex(0);
    setCurrentState('chapter-title');
  };

  const handleNavigateToPage = (chapterIndex: number, pageIndex: number) => {
    setCurrentChapterIndex(chapterIndex);
    setCurrentPageIndex(pageIndex);
    setCurrentState('chapter-content');
  };

  const handleNavigateToGallery = () => setCurrentState('gallery');
  const handleNavigateToGuestbook = () => setCurrentState('guestbook');

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
        currentPageIndex={currentPageIndex}
        currentState={currentState}
        onNavigateToChapter={handleNavigateToChapter}
        onNavigateToPage={handleNavigateToPage}
        onNavigateToGallery={handleNavigateToGallery}
        onNavigateToGuestbook={handleNavigateToGuestbook}
      />

      {currentState === 'cover' && <BookCover book={book} onNext={handleNext} />}

      {currentState === 'dedication' && hasDedication && (
        <BookDedication
          book={book}
          dedication={book.dedication}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}

      {currentState === 'intro' && hasIntro && (
        <BookIntro
          intro={book.intro}
          introImageUrl={book.intro_image_url}
          introImageCaption={book.intro_image_caption}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
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
          galleryItems={pageGalleryItems}   {/* ← page-level items, not chapter floating ones */}
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

      {showPopup1 && (
        <McFarlandPopup1
          onClose={dismissPopup1}
          onLearnMore={() => { dismissPopup1(); handleGoToKayStory(); }}
        />
      )}

      {showPopup2 && (
        <McFarlandPopup2
          onClose={dismissPopup2}
          onReadStory={() => { dismissPopup2(); handleGoToKayStory(); }}
        />
      )}
    </div>
  );
}
