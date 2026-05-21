import React from 'react';
import { Book, Chapter } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import { TextField, SectionHeading, SectionKicker } from './formFields';

interface ChapterTitleEditViewProps {
  book: Book;
  chapter: Chapter;
  onChange: (patch: Partial<Chapter>) => void;
}

/**
 * Chapter title screen: the form IS the heading.
 * Centered vertically so the small two-field form doesn't look orphaned
 * at the top of a tall column.
 */
export default function ChapterTitleEditView({ book, chapter, onChange }: ChapterTitleEditViewProps) {
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
        </>
      }
    />
  );
}
