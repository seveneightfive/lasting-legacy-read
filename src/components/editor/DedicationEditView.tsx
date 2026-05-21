import React from 'react';
import { Book } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import RichTextEditor from './RichTextEditor';
import { FieldLabel, SectionHeading, SectionKicker } from './formFields';

interface DedicationEditViewProps {
  book: Book;
  onChange: (patch: Partial<Book>) => void;
}

/**
 * Dedication screen: short standalone tribute. Centered like the Cover
 * and Chapter Title screens for consistent breathing room.
 */
export default function DedicationEditView({ book, onChange }: DedicationEditViewProps) {
  return (
    <SplitScreenLayout
      rightAlign="center"
      left={
        <ImagePicker
          value={book.image_url}
          onChange={(url) => onChange({ image_url: (url ?? null) as string | undefined })}
          folder={book.slug}
          variant="cover"
          placeholder="Add an image for the dedication page"
        />
      }
      right={
        <>
          <SectionKicker centered>Book</SectionKicker>
          <SectionHeading centered hint="A short tribute or message that appears before the story begins.">
            Dedication
          </SectionHeading>
          <FieldLabel>Dedication text</FieldLabel>
          <RichTextEditor
            value={book.dedication ?? ''}
            onChange={(html) => onChange({ dedication: html })}
            placeholder="To my children, who heard these stories first…"
            bookSlug={book.slug}
          />
        </>
      }
    />
  );
}
