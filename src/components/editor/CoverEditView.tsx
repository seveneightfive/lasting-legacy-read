import React from 'react';
import { Book } from '../../lib/supabase';
import SplitScreenLayout from './SplitScreenLayout';
import ImagePicker from './ImagePicker';
import { TextField, SectionHeading, SectionKicker } from './formFields';

interface CoverEditViewProps {
  book: Book;
  onChange: (patch: Partial<Book>) => void;
}

/**
 * Book cover screen: the title and author ARE the book's identity.
 * Treated like the Chapter Title screen — centered, with the form
 * surrounded by breathing room.
 */
export default function CoverEditView({ book, onChange }: CoverEditViewProps) {
  return (
    <SplitScreenLayout
      rightAlign="center"
      left={
        <ImagePicker
          value={book.image_url}
          onChange={(url) => onChange({ image_url: (url ?? null) as string | undefined })}
          folder={book.slug}
          variant="cover"
          placeholder="Add a cover photo"
        />
      }
      right={
        <>
          <SectionKicker centered>Book</SectionKicker>
          <SectionHeading centered hint="The first thing readers see when they open the story.">
            Cover
          </SectionHeading>
          <TextField
            label="Title"
            value={book.title}
            onChange={(v) => onChange({ title: v })}
            placeholder="The title of the book"
          />
          <TextField
            label="Author"
            value={book.author}
            onChange={(v) => onChange({ author: v })}
            placeholder="Author name"
          />
        </>
      }
    />
  );
}
