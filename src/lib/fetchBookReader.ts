import { supabase, Book, Chapter, Page, GalleryItem, GuestbookEntry } from './supabase';

/**
 * Chapter shape returned by get_book_reader — a normal Chapter plus its
 * pages (already ordered, already carrying page-level gallery for
 * gallery pages) and its own chapter-level gallery (page_id IS NULL rows).
 *
 * `book_id` isn't part of the RPC's chapter object (it's implied by the
 * call), so App.tsx stamps it back on after the fetch to keep this a
 * drop-in replacement for the existing `Chapter` type used elsewhere.
 */
export type ChapterWithReaderData = Chapter & {
  pages: Page[] | null;
  chapter_gallery: GalleryItem[] | null;
};

export interface BookReaderPayload {
  id: number;
  slug: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  dedication: string | null;
  intro: string | null;
  intro_image_url: string | null;
  intro_image_caption: string | null;
  filloutform_link: string | null;
  chapters: ChapterWithReaderData[] | null;
  guestbook: GuestbookEntry[] | null;
}

/**
 * Single RPC call that replaces:
 *  - App.tsx's books fetch + chapters fetch + N per-chapter page-count queries
 *  - BookReader.tsx's fetchPages / fetchGalleryItems / fetchChapterGalleryItems / fetchGuestbookEntries
 *  - NavigationMenu.tsx's per-chapter loadPagesForChapter lazy fetch
 *
 * Because the underlying SQL function is a plain (non-materialized) view
 * over the tables, it always reflects the latest Glide-synced data — no
 * cache invalidation needed on the read side.
 */
export async function fetchBookReader(slug: string): Promise<BookReaderPayload | null> {
  const { data, error } = await supabase.rpc('get_book_reader', { p_slug: slug });
  if (error) {
    console.error('get_book_reader error:', error);
    throw error;
  }
  return (data as BookReaderPayload) ?? null;
}
