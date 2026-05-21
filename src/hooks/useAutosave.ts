import { useEffect, useRef, useState, useCallback } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  value: T;
  onSave: (value: T) => Promise<void>;
  delay?: number;     // ms to wait after last change before saving
  enabled?: boolean;  // if false, autosave is disabled
  /**
   * Identity of the record being edited. When this changes, the hook
   * flushes any pending save for the previous record and treats the
   * incoming `value` as the new baseline. Use e.g. the page or chapter id.
   */
  resetKey?: string | number;
}

/**
 * Debounced autosave hook.
 *
 * - Watches `value` and triggers `onSave` after `delay` ms of inactivity.
 * - Exposes `status` for showing "Saving…" / "Saved" UI.
 * - Exposes `flush()` to force-save immediately (call this from Exit).
 * - Honors `resetKey` for switching between records (page / chapter).
 */
export function useAutosave<T>({
  value,
  onSave,
  delay = 2000,
  enabled = true,
  resetKey,
}: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialValueRef = useRef<T>(value);
  const latestValueRef = useRef<T>(value);
  const onSaveRef = useRef(onSave);
  const lastResetKeyRef = useRef<string | number | undefined>(resetKey);

  // Keep latest value + onSave in refs so the debounce effect doesn't
  // re-fire on identity changes alone.
  useEffect(() => { latestValueRef.current = value; }, [value]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const performSave = useCallback(async () => {
    setStatus('saving');
    try {
      await onSaveRef.current(latestValueRef.current);
      initialValueRef.current = latestValueRef.current;
      setStatus('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('[autosave] save failed:', err);
      setStatus('error');
    }
  }, []);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (latestValueRef.current !== initialValueRef.current) {
      await performSave();
    }
  }, [performSave]);

  // When resetKey changes (user navigated to a different record),
  // flush any pending save for the OLD record, then reset the baseline.
  useEffect(() => {
    if (resetKey === lastResetKeyRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      // Fire save for the previous record in the background.
      void performSave();
    }
    lastResetKeyRef.current = resetKey;
    initialValueRef.current = value;
    latestValueRef.current = value;
    setStatus('idle');
    // We intentionally exclude `value` from deps — we only want this to
    // run when resetKey itself changes, capturing whatever value is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, performSave]);

  // Main debounce effect
  useEffect(() => {
    if (!enabled) return;
    if (value === initialValueRef.current) return;

    setStatus('pending');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void performSave();
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay, enabled, performSave]);

  return { status, lastSavedAt, flush };
}
