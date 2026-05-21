import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'story-images';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadResult {
  publicUrl: string;
  path: string;
}

interface UseImageUploadOptions {
  /** Folder under the bucket — typically the book slug */
  folder: string;
}

function makeFilename(originalName: string): string {
  const cleanExt = (originalName.split('.').pop() ?? 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const ext = cleanExt && cleanExt.length <= 4 ? cleanExt : 'jpg';
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18);
  return `${Date.now()}-${id}.${ext}`;
}

/**
 * Uploads images to Supabase Storage.
 *
 *   const { upload, uploading, error } = useImageUpload({ folder: book.slug });
 *   const result = await upload(file);  // returns { publicUrl, path } | null
 */
export function useImageUpload({ folder }: UseImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Unsupported format. Use JPG, PNG, WebP, or GIF.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`;
    }
    return null;
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    const path = `${folder}/${makeFilename(file.name)}`;
    setUploading(true);
    setError(null);

    try {
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error('Could not get public URL after upload');

      return { publicUrl: publicData.publicUrl, path };
    } catch (err) {
      console.error('[useImageUpload] failed:', err);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, [folder, validate]);

  return {
    upload,
    uploading,
    error,
    clearError: () => setError(null),
  };
}
