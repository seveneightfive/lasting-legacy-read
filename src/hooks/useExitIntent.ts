import { useEffect, useState } from 'react';

const SESSION_KEY = 'llo_exit_intent_shown';

// Fires once per browser tab session when the reader's mouse leaves
// through the top of the viewport (the standard "exit intent" signal
// on desktop — there's no reliable equivalent for mobile/tab-close,
// since browsers block custom UI in beforeunload).
export function useExitIntent(enabled: boolean = true) {
  const [showExitIntent, setShowExitIntent] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const handleMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem(SESSION_KEY)) {
        setShowExitIntent(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
      }
    };

    document.addEventListener('mouseout', handleMouseOut);
    return () => document.removeEventListener('mouseout', handleMouseOut);
  }, [enabled]);

  const dismissExitIntent = () => setShowExitIntent(false);

  return { showExitIntent, dismissExitIntent };
}
