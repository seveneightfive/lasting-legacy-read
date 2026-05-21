import React from 'react';
import { Book, Chapter, Page, GalleryItem } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import RichTextEditor from './RichTextEditor';
import GalleryEditor from './GalleryEditor';
import { TextField, FieldLabel } from './formFields';
import { hasWordPressMarkup, sanitizeWordPressHtml } from '../../utils/sanitizeWordPressHtml';
import { Sparkles } from 'lucide-react';

interface PageEditViewProps {
  book: Book;
  chapter: Chapter;
  page: Page;
  galleryItems: GalleryItem[];
  pageNumber: number;
  totalPages: number;
  onChange: (patch: Partial<Page>) => void;
  onGalleryChanged?: () => void;
  onAddToGallery: (imageUrl: string, caption?: string) => Promise<void>;
}

/**
 * Page editor — the workhorse view.
 *
 * Header is intentionally minimal here (top-bar breadcrumb carries the
 * chapter/page context). Right column is the scroll container; toolbar
 * inside the rich-text editor sticks to the top while you scroll.
 */
export default function PageEditView({
  book, chapter, page, galleryItems, onChange, onGalleryChanged, onAddToGallery,
}: PageEditViewProps) {
  const needsCleanup = hasWordPressMarkup(page.content);

  return (
    <SplitScreenLayout
      left={
        <ImagePicker
          value={page.image_url}
          onChange={(url) => onChange({ image_url: (url ?? null) as string | undefined })}
          folder={book.slug}
          caption={page.image_caption}
          onCaptionChange={(v) => onChange({ image_caption: v })}
          placeholder="Add a photo for this page"
        />
      }
      right={
        <>
          <TextField
            label="Page heading"
            value={page.subtitle ?? ''}
            onChange={(v) => onChange({ subtitle: v })}
            placeholder="An optional heading for this page"
          />

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Story content</FieldLabel>
              {needsCleanup && (
                <button
                  type="button"
                  onClick={() => onChange({ content: sanitizeWordPressHtml(page.content ?? '') })}
                  className="flex items-center gap-1 text-xs font-avenir text-amber-700 hover:text-amber-800"
                  title="This page has legacy WordPress markup. Click to clean it up."
                >
                  <Sparkles size={12} />
                  Clean up legacy markup
                </button>
              )}
            </div>
            <RichTextEditor
              value={page.content ?? ''}
              onChange={(html) => onChange({ content: html })}
              placeholder="Tell the story…"
              bookSlug={book.slug}
              onAddToGallery={onAddToGallery}
              stickyToolbar
            />
          </div>

          <div className="mb-5">
            <FieldLabel>Pull quote (optional)</FieldLabel>
            <RichTextEditor
              value={page.quote ?? ''}
              onChange={(html) => onChange({ quote: html })}
              placeholder="A quote that stands out from the prose"
              bookSlug={book.slug}
              hideToolbar
            />
          </div>

          <TextField
            label="Quote attribution"
            value={page.quote_attribute ?? ''}
            onChange={(v) => onChange({ quote_attribute: v })}
            placeholder="— Who said it"
          />

          <div className="mt-8 pt-6 border-t border-slate-200">
            <GalleryEditor
              pageId={page.id}
              chapterId={chapter.id}
              bookSlug={book.slug}
              initialItems={galleryItems}
              onChanged={onGalleryChanged}
            />
          </div>
        </>
      }
    />
  );
}
