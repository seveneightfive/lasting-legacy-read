import { useEffect, useState } from 'react';
import { pairingMode, PairingState } from '../utils/pairingMode';

/**
 * React hook that subscribes to the pairingMode singleton.
 * Returns the current state — components re-render when it changes.
 */
export function usePairingMode(): PairingState {
  const [state, setState] = useState<PairingState>(pairingMode.get());
  useEffect(() => {
    setState(pairingMode.get());
    const unsub = pairingMode.subscribe(setState);
    return () => { unsub(); };
  }, []);
  return state;
}
