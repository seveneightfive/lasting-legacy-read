import { supabase, Book, Chapter, Page, GalleryItem } from '../lib/supabase';

export interface ChapterWithFullData extends Chapter {
  pages: Page[];
  galleryItems: GalleryItem[];
}

export interface BookWithFullData {
  book: Book;
  chapters: ChapterWithFullData[];
  allGalleryItems: GalleryItem[];
}

export async function fetchCompleteBookData(bookId: number): Promise<BookWithFullData | null> {
  try {
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .maybeSingle();

    if (bookError) {
      console.error('Error fetching book:', bookError);
      throw bookError;
    }

    if (!book) {
      console.error('Book not found');
      return null;
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('number', { ascending: true });

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError);
      throw chaptersError;
    }

    if (!chapters || chapters.length === 0) {
      return {
        book,
        chapters: [],
        allGalleryItems: []
      };
    }

    const chaptersWithData: ChapterWithFullData[] = [];
    const allGalleryItems: GalleryItem[] = [];

    for (const chapter of chapters) {
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('*')
        .eq('chapter_id', chapter.id)
        .order('sort_order', { ascending: true });

      if (pagesError) {
        console.error('Error fetching pages for chapter:', chapter.id, pagesError);
        continue;
      }

      const { data: galleryItems, error: galleryError } = await supabase
        .from('gallery')
        .select('*')
        .eq('chapter_id', chapter.id)
        .order('sort_order', { ascending: true });

      if (galleryError) {
        console.error('Error fetching gallery items for chapter:', chapter.id, galleryError);
      }

      const chapterGalleryItems = galleryItems || [];

      if (pages && pages.length > 0) {
        chaptersWithData.push({
          ...chapter,
          pages: pages || [],
          galleryItems: chapterGalleryItems
        });

        allGalleryItems.push(...chapterGalleryItems);
      }
    }

    return {
      book,
      chapters: chaptersWithData,
      allGalleryItems
    };
  } catch (error) {
    console.error('Error fetching complete book data:', error);
    throw error;
  }
}

export async function loadImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', url, error);
    throw error;
  }
}

export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = url;
  });
}
