import { Page } from '../lib/supabase';

/**
 * Effective display order for a page.
 * final_order is owned by the web editor; sort_order is owned by Glide/Whalesync.
 * The editor's reordering writes only to final_order, so we prefer it when set.
 */
export function effectiveOrder(p: Page): number {
  return p.final_order ?? p.sort_order ?? 0;
}

/**
 * Sort an array of pages into reader/editor display order.
 * Filters out soft-deleted pages.
 */
export function sortPagesForDisplay(pages: Page[]): Page[] {
  return pages
    .filter((p) => !p.is_deleted)
    .slice()
    .sort((a, b) => effectiveOrder(a) - effectiveOrder(b));
}
