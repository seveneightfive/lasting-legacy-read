import React from 'react';
import { Book } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import RichTextEditor from './RichTextEditor';
import { SectionHeading, FieldLabel } from './formFields';

interface IntroEditViewProps {
  book: Book;
  onChange: (patch: Partial<Book>) => void;
}

export default function IntroEditView({ book, onChange }: IntroEditViewProps) {
  return (
    <SplitScreenLayout
      breadcrumb="Introduction"
      left={
        <ImagePicker
          value={book.intro_image_url}
          onChange={(url) => onChange({ intro_image_url: (url ?? null) as string | undefined })}
          folder={book.slug}
          caption={book.intro_image_caption}
          onCaptionChange={(v) => onChange({ intro_image_caption: v })}
          placeholder="Add a photo for the introduction"
        />
      }
      right={
        <>
          <SectionHeading hint="The opening to the story — context, a welcome, or how it came to be told.">
            Introduction
          </SectionHeading>
          <FieldLabel>Introduction text</FieldLabel>
          <RichTextEditor
            value={book.intro ?? ''}
            onChange={(html) => onChange({ intro: html })}
            placeholder="Open the story…"
            bookSlug={book.slug}
          />
        </>
      }
    />
  );
}
