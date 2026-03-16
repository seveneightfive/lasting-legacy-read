import { supabase, Book, Chapter, Page } from './supabase';

export type ChapterWithPages = Chapter & {
  pages: Page[];
};

export async function fetchAllPagesForChapters(chapters: Chapter[]): Promise<ChapterWithPages[]> {
  const chaptersWithPages: ChapterWithPages[] = [];

  for (const chapter of chapters) {
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('chapter_id', chapter.id)
      .order('page_order', { ascending: true });

    if (error) {
      console.error('Error fetching pages for chapter:', chapter.id, error);
      continue;
    }

    chaptersWithPages.push({
      ...chapter,
      pages: pages || []
    });
  }

  return chaptersWithPages;
}