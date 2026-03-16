// ═══════════════════════════════════════════════════════
// BOOKREADER.TSX — TWO CHANGES NEEDED
// ═══════════════════════════════════════════════════════
// You don't need to replace the whole file.
// Make these two targeted changes:

// ─────────────────────────────────────────────────────
// CHANGE 1: In fetchPages(), also fetch chapter gallery
// 
// Find this function (around line 55):
//
//   const fetchPages = async (chapterId: number) => {
//     setLoading(true);
//     try {
//       const { data, error } = await supabase
//         .from('pages')
//         .select('*')
//         .eq('chapter_id', chapterId)
//         .order('sort_order', { ascending: true });
//
//       if (error) throw error;
//       setPages(data || []);
//       setCurrentPageIndex(0);
//     } catch (error) {
//       console.error('Error fetching pages:', error);
//     } finally {
//       setLoading(false);
//     }
//   };
//
// REPLACE IT WITH:

const fetchPages = async (chapterId: number) => {
  setLoading(true);
  try {
    // Fetch pages and chapter gallery in parallel
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
        .order('sort_order', { ascending: true })
    ]);

    if (pagesResult.error) throw pagesResult.error;
    setPages(pagesResult.data || []);
    setChapterGalleryItems(galleryResult.data || []);  // reuse existing state
    setCurrentPageIndex(0);
  } catch (error) {
    console.error('Error fetching pages:', error);
  } finally {
    setLoading(false);
  }
};

// ─────────────────────────────────────────────────────
// CHANGE 2: Pass galleryItems to ChapterReader
//
// Find this block (around line 245):
//
//   {currentState === 'chapter-content' && currentChapter && pages.length > 0 && (
//     <ChapterReader
//       chapter={currentChapter}
//       page={pages[currentPageIndex]}
//       pageNumber={currentPageIndex + 1}
//       totalPages={pages.length}
//       onNext={handleNext}
//       onPrevious={handlePrevious}
//     />
//   )}
//
// REPLACE IT WITH:

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

// ─────────────────────────────────────────────────────
// That's it! Just those two changes.
// The chapterGalleryItems state already exists in BookReader
// so no new state needed.
// ═══════════════════════════════════════════════════════

