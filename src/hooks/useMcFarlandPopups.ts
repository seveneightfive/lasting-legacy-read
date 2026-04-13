import { useState, useEffect } from 'react';

const POPUP1_KEY = 'mcfarland_popup1_seen';
const POPUP2_KEY = 'mcfarland_popup2_seen';

// How many pages deep before popup 1 appears
const POPUP1_PAGE_THRESHOLD = 2;

interface UseMcFarlandPopupsOptions {
  // The current "page number" across the whole book reading session
  // Increment this every time the reader advances (pages, chapter transitions, etc.)
  globalPageCount: number;
  // True when the reader has reached the very end (thank-you or guestbook state)
  isAtEnd: boolean;
  // Skip showing popups for Kay's own book
  isKayMcFarlandBook?: boolean;
}

interface UseMcFarlandPopupsResult {
  showPopup1: boolean;
  showPopup2: boolean;
  dismissPopup1: () => void;
  dismissPopup2: () => void;
}

export function useMcFarlandPopups({
  globalPageCount,
  isAtEnd,
  isKayMcFarlandBook = false,
}: UseMcFarlandPopupsOptions): UseMcFarlandPopupsResult {
  const [showPopup1, setShowPopup1] = useState(false);
  const [showPopup2, setShowPopup2] = useState(false);

  // Popup 1: show after threshold pages, once ever
  useEffect(() => {
    if (isKayMcFarlandBook) return;
    if (globalPageCount < POPUP1_PAGE_THRESHOLD) return;
    const alreadySeen = localStorage.getItem(POPUP1_KEY);
    if (!alreadySeen) {
      setShowPopup1(true);
    }
  }, [globalPageCount, isKayMcFarlandBook]);

  // Popup 2: show when reader reaches the end, once ever
  useEffect(() => {
    if (isKayMcFarlandBook) return;
    if (!isAtEnd) return;
    const alreadySeen = localStorage.getItem(POPUP2_KEY);
    if (!alreadySeen) {
      setShowPopup2(true);
    }
  }, [isAtEnd, isKayMcFarlandBook]);

  const dismissPopup1 = () => {
    localStorage.setItem(POPUP1_KEY, 'true');
    setShowPopup1(false);
  };

  const dismissPopup2 = () => {
    localStorage.setItem(POPUP2_KEY, 'true');
    setShowPopup2(false);
  };

  return { showPopup1, showPopup2, dismissPopup1, dismissPopup2 };
}
