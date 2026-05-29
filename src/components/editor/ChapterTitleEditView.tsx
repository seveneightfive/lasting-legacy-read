import React from 'react';
import { Book, Chapter, GalleryItem } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import GalleryEditor from './GalleryEditor';
import { TextField, SectionHeading, SectionKicker } from './formFields';

interface ChapterTitleEditViewProps {
  book: Book;
  chapter: Chapter;
  galleryItems: GalleryItem[];
  onChange: (patch: Partial<Chapter>) => void;
  onGalleryChanged?: () => void;
}

export default function ChapterTitleEditView({
  book, chapter, galleryItems, onChange, onGalleryChanged,
}: ChapterTitleEditViewProps) {
  return (
    <SplitScreenLayout
      rightAlign="center"
      left={
        <ImagePicker
          value={chapter.image_url}
          onChange={(url) => onChange({ image_url: (url ?? null) as string | undefined })}
          folder={book.slug}
          placeholder="Add a chapter opener image"
        />
      }
      right={
        <>
          <SectionKicker centered>Chapter {chapter.number}</SectionKicker>
          <SectionHeading centered hint="Readers see this screen before the chapter's first page.">
            Chapter Title
          </SectionHeading>
          <TextField
            label="Title"
            value={chapter.title}
            onChange={(v) => onChange({ title: v })}
            placeholder="What is this chapter called?"
          />
          <TextField
            label="Lede / subtitle"
            value={chapter.lede ?? ''}
            onChange={(v) => onChange({ lede: v })}
            placeholder="A short line that sets up the chapter"
            multiline
          />

          <div className="mt-8 pt-6 border-t border-slate-200">
            <GalleryEditor
              pageId={null}
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
