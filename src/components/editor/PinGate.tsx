import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X } from 'lucide-react';

interface PinGateProps {
  bookTitle: string;
  expectedPin: string;
  onUnlock: () => void;
  onCancel: () => void;
}

export default function PinGate({ bookTitle, expectedPin, onUnlock, onCancel }: PinGateProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, value: string) => {
    // Only digits, single char
    const cleaned = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    setError(false);

    // Auto-advance
    if (cleaned && idx < 3) {
      inputsRef.current[idx + 1]?.focus();
    }

    // Auto-submit when all 4 are entered
    if (idx === 3 && cleaned) {
      const fullPin = next.join('');
      tryUnlock(fullPin);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = digits.join('');
      if (fullPin.length === 4) tryUnlock(fullPin);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const arr = pasted.split('');
      setDigits(arr);
      tryUnlock(pasted);
    }
  };

  const tryUnlock = (pin: string) => {
    if (pin === String(expectedPin)) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      // Clear digits after a short delay
      setTimeout(() => {
        setDigits(['', '', '', '']);
        inputsRef.current[0]?.focus();
      }, 600);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            x: shake ? [0, -10, 10, -10, 10, 0] : 0,
          }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
        >
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cancel"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
              <Lock size={24} className="text-slate-700" />
            </div>
            <h2 className="text-2xl font-avenir text-slate-800 mb-2 heading-tracking">
              Edit Story
            </h2>
            <p className="text-slate-600 font-lora text-sm">
              Enter the 4-digit edit code for
              <br />
              <span className="italic">{bookTitle}</span>
            </p>
          </div>

          <div className="flex justify-center gap-3 mb-4">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className={`w-14 h-16 text-center text-2xl font-avenir border-2 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors
                  ${error
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-slate-300 bg-white text-slate-800'
                  }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-600 font-avenir mb-2">
              Incorrect code. Please try again.
            </p>
          )}

          <p className="text-center text-xs text-slate-400 font-avenir mt-4">
            Don't have a code? Contact the story owner.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
