import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper, { Area } from 'react-easy-crop';
import { X, RotateCcw, RotateCw, Loader2 } from 'lucide-react';
import { getCroppedImageBlob } from '../../utils/cropImage';

interface CropModalProps {
  open: boolean;
  imageUrl: string;
  /** Locks the crop box to a ratio (e.g. 4/3). Pass undefined for freeform. */
  aspect?: number;
  onCancel: () => void;
  /** Receives the cropped image as a Blob — caller handles upload + row update. */
  onSave: (blob: Blob) => void | Promise<void>;
}

export default function CropModal({ open, imageUrl, aspect, onCancel, onSave }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageUrl, croppedAreaPixels, rotation);
      await onSave(blob);
      reset();
    } catch (err) {
      console.error('Crop failed:', err);
      setError('Could not process this image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[80]"
        onClick={handleCancel}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl bg-white rounded-xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <h3 className="font-avenir text-slate-800 text-sm font-semibold">Crop & Rotate</h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>

          {/* Crop stage */}
          <div className="relative w-full h-[420px] bg-slate-900 shrink-0">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="px-5 py-4 space-y-4 border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-avenir text-slate-500 w-14 shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-slate-800"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-avenir text-slate-500 w-14 shrink-0">Rotate</span>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 accent-slate-800"
              />
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label="Rotate left 90°"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                aria-label="Rotate right 90°"
              >
                <RotateCw size={16} />
              </button>
            </div>

            {error && (
              <div className="px-3 py-2 text-xs font-avenir text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-avenir text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !croppedAreaPixels}
              className="flex items-center gap-2 px-4 py-2 text-sm font-avenir text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}