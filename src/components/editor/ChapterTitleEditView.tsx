import React from 'react';
import { Book, Chapter } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import { TextField, SectionHeading } from './formFields';

interface ChapterTitleEditViewProps {
  book: Book;
  chapter: Chapter;
  onChange: (patch: Partial<Chapter>) => void;
}

export default function ChapterTitleEditView({ book, chapter, onChange }: ChapterTitleEditViewProps) {
  return (
    <SplitScreenLayout
      breadcrumb={`Chapter ${chapter.number}`}
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
          <SectionHeading hint="The chapter's opening screen — readers see this before the first page.">
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
