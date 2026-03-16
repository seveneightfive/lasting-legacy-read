import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Book {
  id: number;
  title: string;
  author: string;
  slug: string;
  image_url?: string;
  dedication?: string;
  intro?: string;
  created_at?: string;
  date_published?: string;
  view_count?: number;
  filloutform_link?: string;
  user?: string;
}

export interface Chapter {
  id: number;
  title: string;
  lede?: string;
  book_id: number;
  number: number;
  image_url?: string;
  created_at?: string;
  user?: string;
  row_id?: string;
}

export interface Page {
  id: number;
  chapter_id: number;
  content?: string;
  image_url?: string;
  quote?: string;
  quote_attribute?: string;
  image_caption?: string;
  subtitle?: string;
  created_at?: string;
  sort_order?: number;
  final_order?: number;
  user?: string;
  row_
cat > src/lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Book {
  id: number;
  title: string;
  author: string;
  slug: string;
  image_url?: string;
  dedication?: string;
  intro?: string;
  created_at?: string;
  date_published?: string;
  view_count?: number;
  filloutform_link?: string;
  user?: string;
}

export interface Chapter {
  id: number;
  title: string;
  lede?: string;
  book_id: number;
  number: number;
  image_url?: string;
  created_at?: string;
  user?: string;
  row_id?: string;
}

export interface Page {
  id: number;
  chapter_id: number;
  content?: string;
  image_url?: string;
  quote?: string;
  quote_attribute?: string;
  image_caption?: string;
  subtitle?: string;
  created_at?: string;
  sort_order?: number;
  final_order?: number;
  user?: string;
  row_id?: string;
}

export interface GalleryItem {
  id: number;
  image_title?: string;
  image_url: string;
  image_caption?: string;
  chapter_id: number;
  page_id?: number;
  created_at?: string;
  sort_order?: number;
  user?: string;
  row_id?: string;
}

export interface GuestbookEntry {
  id: number;
  message?: string;
  private?: string;
  recording?: string;
  guest?: string;
  book_id?: number;
  created_at?: string;
  user?: string;
  guest_email?: string;
}

export type ChapterWithPages = Chapter & {
  pages: Page[];
};
