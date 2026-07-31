import React, { useState, useEffect } from 'react';
import { supabase, Book, GalleryItem, GuestbookEntry } from '../lib/supabase';
import { ChapterWithReaderData } from '../lib/fetchBookReader';
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
  chapters: ChapterWithReaderData[];
  initialGuestbook: GuestbookEntry[];
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
const POPUP1_TRIGGER_PAGE = 4;

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

export default function BookReader({ book, chapters, initialGuestbook }: BookReaderProps) {
  const [currentState, setCurrentState] = useState<ReadingState>('cover');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Guestbook is the one thing that still needs a live refetch after
  // writes (signing the guestbook inserts a row that wasn't in the
  // original page-load payload). Everything else below is now derived
  // — no loading state needed for it.
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>(initialGuestbook);
  const [globalPageCount, setGlobalPageCount] = useState(0);

  const currentChapter = chapters[currentChapterIndex];
  const isAtEnd = currentState === 'guestbook' || currentState === 'thank-you';
  const isKayMcFarlandBook = book.slug === KAY_MCFARLAND_SLUG || book.user === KAY_MCFARLAND_SLUG;

  const hasDedication = hasContent(book.dedication);
  const hasIntro = hasContent(book.intro);
  const hasChapters = chapters.length > 0;

  // All derived straight from the payload chapters already carry —
  // no fetchPages/fetchGalleryItems/fetchChapterGalleryItems needed.
  const pages = currentChapter?.pages ?? [];
  const chapterGalleryItems: GalleryItem[] = currentChapter?.chapter_gallery ?? [];
  const galleryItems: GalleryItem[] = chapters.flatMap((c) => c.chapter_gallery ?? []);
  const pageGalleryItems: GalleryItem[] = pages[currentPageIndex]?.gallery_page
    ? (pages[currentPageIndex] as any).gallery ?? []
    : [];

  const chapterHasGallery = (chapterIndex: number) =>
    (chapters[chapterIndex]?.chapter_gallery?.length ?? 0) > 0;

  // Determines what the BookCover's page-turn flip should land on,
  // so the flip visually hands off into whatever screen comes next.
  const firstChapterHasImage = Boolean(chapters[0]?.image_url);
  const coverNextBg = hasDedication
    ? 'linear-gradient(to bottom right, #0f172a, #334155)' // matches BookDedication's right panel
    : hasIntro
      ? '#f8fafc' // slate-50 — matches BookIntro's background
      : firstChapterHasImage
        ? '#0f172a'
        : '#1e293b'; // matches ChapterTitle's plain (no image) background

  const { showPopup1, showPopup2, dismissPopup1, dismissPopup2 } = useMcFarlandPopups({
    globalPageCount,
    isAtEnd,
    isKayMcFarlandBook,
  });

  const incrementPageCount = () => setGlobalPageCount((n) => n + 1);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentState, currentPageIndex]);

  // Still a live query — guestbook entries are the one piece of state
  // that changes via user action (signing) after the initial page load.
  const fetchGuestbookEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('guestbook')
        .select('*')
        .eq('book_id', book.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGuestbookEntries(data || []);
    } catch (error) {
      console.error('Error fetching guestbook entries:', error);
    }
  };

  const handleNext = () => {
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
        } else if (chapterHasGallery(currentChapterIndex)) {
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

  const handlePrevious = () => {
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
          setCurrentChapterIndex(previousChapterIndex);
          setCurrentState(chapterHasGallery(previousChapterIndex) ? 'chapter-gallery' : 'chapter-content');
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
          setCurrentChapterIndex(lastChapterIndex);
          setCurrentState(chapterHasGallery(lastChapterIndex) ? 'chapter-gallery' : 'chapter-content');
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

      {currentState === 'cover' && (
        <BookCover book={book} onNext={handleNext} nextBackground={coverNextBg} />
      )}

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
          galleryItems={pageGalleryItems}
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
          onEntryAdded={fetchGuestbookEntries}
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
