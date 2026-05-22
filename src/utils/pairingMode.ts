/**
 * Pairing mode — a small global state machine for the "click to pair figures"
 * UX. Only one editor instance should be in pairing mode at a time, so a
 * module-level singleton is the simplest mental model.
 *
 * Lifecycle:
 *   1. User clicks "Pair with..." on figure A → start(sourcePos)
 *   2. Other figures get a "click me to pair" highlight; cursor becomes crosshair
 *   3. User clicks figure B → consumer dispatches the merge transaction → end()
 *   4. User presses Escape or clicks Cancel → end()
 *
 * Consumers subscribe via subscribe() and re-render based on the current state.
 *
 * This intentionally lives OUTSIDE React so the FigureNodeView (which doesn't
 * receive props from a shared parent) can read and write it.
 */

export interface PairingState {
  /** When non-null, pairing mode is active and this is the source figure's pos */
  sourcePos: number | null;
}

type Listener = (state: PairingState) => void;

let state: PairingState = { sourcePos: null };
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(state);
}

export const pairingMode = {
  get(): PairingState {
    return state;
  },
  start(sourcePos: number): void {
    state = { sourcePos };
    emit();
  },
  end(): void {
    if (state.sourcePos === null) return;
    state = { sourcePos: null };
    emit();
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Allow Escape to cancel from anywhere
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.sourcePos !== null) {
      pairingMode.end();
    }
  });
}
