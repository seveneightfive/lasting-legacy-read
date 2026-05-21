import { Book, Chapter, Page } from '../lib/supabase';

// ─── State machine ────────────────────────────────────────────────
// Mirrors BookReader's ReadingState but for editing.
export type EditorState =
  | { kind: 'cover' }
  | { kind: 'dedication' }
  | { kind: 'intro' }
  | { kind: 'chapter-title';   chapterIndex: number }
  | { kind: 'page';             chapterIndex: number; pageIndex: number };

export function stateKey(state: EditorState): string {
  switch (state.kind) {
    case 'cover':         return 'cover';
    case 'dedication':    return 'dedication';
    case 'intro':         return 'intro';
    case 'chapter-title': return `chapter:${state.chapterIndex}`;
    case 'page':          return `page:${state.chapterIndex}:${state.pageIndex}`;
  }
}

// ─── TOC node model (what the sidebar tree renders) ───────────────
export type TocNode =
  | { kind: 'book-section'; label: string; state: EditorState; enabled: boolean }
  | { kind: 'chapter';      chapter: Chapter; state: EditorState; pages: TocPageNode[] };

export interface TocPageNode {
  page: Page;
  state: EditorState;
  label: string;
}

/**
 * Build the TOC tree from book + chapters + a map of pages-per-chapter.
 */
export function buildToc(
  book: Book,
  chapters: Chapter[],
  pagesByChapter: Map<number, Page[]>,
): TocNode[] {
  const nodes: TocNode[] = [];

  nodes.push({
    kind: 'book-section',
    label: 'Cover',
    state: { kind: 'cover' },
    enabled: true,
  });
  nodes.push({
    kind: 'book-section',
    label: 'Dedication',
    state: { kind: 'dedication' },
    enabled: true,
  });
  nodes.push({
    kind: 'book-section',
    label: 'Introduction',
    state: { kind: 'intro' },
    enabled: true,
  });

  chapters.forEach((chapter, chapterIndex) => {
    const pages = pagesByChapter.get(chapter.id) ?? [];
    const pageNodes: TocPageNode[] = pages.map((page, pageIndex) => ({
      page,
      label: page.subtitle?.trim() || `Page ${pageIndex + 1}`,
      state: { kind: 'page', chapterIndex, pageIndex },
    }));
    nodes.push({
      kind: 'chapter',
      chapter,
      state: { kind: 'chapter-title', chapterIndex },
      pages: pageNodes,
    });
  });

  return nodes;
}

/**
 * Linear order of all editor states — used for "Next" / "Previous"
 * navigation that mirrors how readers experience the story.
 */
export function flattenStates(toc: TocNode[]): EditorState[] {
  const out: EditorState[] = [];
  for (const node of toc) {
    if (node.kind === 'book-section') {
      out.push(node.state);
    } else {
      out.push(node.state); // chapter title
      for (const p of node.pages) out.push(p.state);
    }
  }
  return out;
}

export function nextState(current: EditorState, all: EditorState[]): EditorState | null {
  const idx = all.findIndex((s) => stateKey(s) === stateKey(current));
  if (idx < 0 || idx >= all.length - 1) return null;
  return all[idx + 1];
}

export function prevState(current: EditorState, all: EditorState[]): EditorState | null {
  const idx = all.findIndex((s) => stateKey(s) === stateKey(current));
  if (idx <= 0) return null;
  return all[idx - 1];
}
