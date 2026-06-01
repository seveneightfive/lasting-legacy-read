import React from 'react';
import { Book, Chapter, Page, GalleryItem } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import RichTextEditor from './RichTextEditor';
import GalleryEditor from './GalleryEditor';
import { TextField, FieldLabel } from './formFields';
import { hasWordPressMarkup, sanitizeWordPressHtml } from '../../utils/sanitizeWordPressHtml';
import { Sparkles, LayoutGrid } from 'lucide-react';

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

          {/* ── Gallery section ─────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-slate-200">

            {/* Gallery page toggle */}
            <div className="flex items-center justify-between mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2.5">
                <LayoutGrid size={15} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-avenir text-slate-700 leading-tight">Gallery page</p>
                  <p className="text-xs text-slate-400 font-avenir mt-0.5">
                    Show all photos as a full-width grid instead of the split layout
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={page.gallery_page ?? false}
                onClick={() => onChange({ gallery_page: !(page.gallery_page ?? false) })}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent',
                  'transition-colors duration-200 ease-in-out',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1',
                  page.gallery_page ? 'bg-slate-700' : 'bg-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
                    'transition duration-200 ease-in-out',
                    page.gallery_page ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>

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
