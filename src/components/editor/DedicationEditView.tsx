import React from 'react';
import { Book } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import RichTextEditor from './RichTextEditor';
import { SectionHeading, FieldLabel } from './formFields';

interface DedicationEditViewProps {
  book: Book;
  onChange: (patch: Partial<Book>) => void;
}

/**
 * The dedication has no dedicated image field on books — we reuse
 * the book cover image_url as the visual companion. If you want a
 * separate dedication image later, add a column and swap it here.
 */
export default function DedicationEditView({ book, onChange }: DedicationEditViewProps) {
  return (
    <SplitScreenLayout
      breadcrumb="Dedication"
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
          <SectionHeading hint="A short tribute or message that appears before the story begins.">
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
