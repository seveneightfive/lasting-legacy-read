import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ImageIcon } from 'lucide-react';
import { TextField } from './FormFields';
import { useImageUpload } from '../../hooks/useImageUpload';

export interface NewChapterPayload {
  number: number;
  title: string;
  lede: string;
  imageUrl: string | null;
}

interface AddChapterModalProps {
  open: boolean;
  suggestedNumber: number;
  bookSlug: string;
  onCancel: () => void;
  onSubmit: (payload: NewChapterPayload) => Promise<void> | void;
}

export default function AddChapterModal({
  open, suggestedNumber, bookSlug, onCancel, onSubmit,
}: AddChapterModalProps) {
  const [number, setNumber] = useState(String(suggestedNumber));
  const [title, setTitle] = useState('');
  const [lede, setLede] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload, uploading } = useImageUpload({ folder: bookSlug });

  // Reset the form each time the modal is (re)opened
  useEffect(() => {
    if (open) {
      setNumber(String(suggestedNumber));
      setTitle('');
      setLede('');
      setImageUrl(null);
      setError(null);
    }
  }, [open, suggestedNumber]);

  const handleFile = async (file: File) => {
    const uploaded = await upload(file);
    if (uploaded) setImageUrl(uploaded.publicUrl);
  };

  const handleSubmit = async () => {
    const parsedNumber = parseInt(number, 10);
    if (!parsedNumber || parsedNumber < 1) {
      setError('Please enter a valid chapter number.');
      return;
    }
    if (!title.trim()) {
      setError('Please give this chapter a title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ number: parsedNumber, title: title.trim(), lede: lede.trim(), imageUrl });
    } catch (err: any) {
      setError(err?.message || 'Could not create the chapter. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[80]"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl pointer-events-auto"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-avenir text-slate-800 text-sm font-semibold">New Chapter</h3>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            <TextField
              label="Chapter number"
              value={number}
              onChange={setNumber}
              placeholder="e.g. 7"
            />
            <TextField
              label="Chapter title"
              value={title}
              onChange={setTitle}
              placeholder="e.g. New Beginnings"
            />
            <TextField
              label="Lede / subtitle (optional)"
              value={lede}
              onChange={setLede}
              placeholder="A short line under the title"
              multiline
            />

            <div className="mb-2">
              <label className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-2">
                Chapter photo (optional)
              </label>
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow text-slate-600 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="w-full flex flex-col items-center gap-1.5 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : (
                    <ImageIcon size={18} className="text-slate-400" />
                  )}
                  <span className="text-xs font-avenir text-slate-500">
                    {uploading ? 'Uploading…' : 'Click to upload'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="mt-3 px-3 py-2 text-xs font-avenir text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-avenir text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-avenir text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Creating…' : 'Create chapter'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
