import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface McFarlandPopup1Props {
  onClose: () => void;
  onLearnMore: () => void;
}

export default function McFarlandPopup1({ onClose, onLearnMore }: McFarlandPopup1Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't feel jarring
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  const handleLearnMore = () => {
    setVisible(false);
    setTimeout(onLearnMore, 400);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="fixed bottom-6 left-1/2 z-50"
          style={{ transform: 'translateX(-50%)', width: 'min(680px, calc(100vw - 2rem))' }}
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #1a2236 0%, #0f1729 60%, #1e3a5f 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Subtle gold accent line at top */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }} />

            <div className="px-7 py-5">
              <div className="flex items-start gap-5">
                {/* Monogram / seal */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-serif"
                  style={{
                    background: 'linear-gradient(135deg, #c9a84c, #e8c96d)',
                    color: '#0f1729',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  KM
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-white font-avenir mb-1"
                    style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }}
                  >
                    This book is free to read — here's why
                  </p>
                  <p
                    className="font-lora leading-relaxed"
                    style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}
                  >
                    Lasting Legacy Online is made possible by the generosity of the McFarland Living Trust —
                    a gift from <span style={{ color: '#e8c96d' }}>Justice Kay McFarland</span>, Kansas Supreme
                    Court Justice and lifelong believer that every life deserves to be remembered.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={handleClose}
                  className="font-avenir transition-colors"
                  style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', padding: '6px 12px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                  Continue reading
                </button>
                <button
                  onClick={handleLearnMore}
                  className="font-avenir transition-all"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#0f1729',
                    background: 'linear-gradient(135deg, #c9a84c, #e8c96d)',
                    padding: '7px 18px',
                    borderRadius: '999px',
                    letterSpacing: '0.02em',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Read Kay's story →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
