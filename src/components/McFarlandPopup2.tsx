import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface McFarlandPopup2Props {
  onClose: () => void;
  onReadStory: () => void;
}

export default function McFarlandPopup2({ onClose, onReadStory }: McFarlandPopup2Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  const handleReadStory = () => {
    setVisible(false);
    setTimeout(onReadStory, 400);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(10, 14, 26, 0.78)', backdropFilter: 'blur(6px)' }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280, delay: 0.05 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="relative rounded-3xl overflow-hidden shadow-2xl"
              style={{
                width: 'min(560px, 100%)',
                background: 'linear-gradient(160deg, #12192e 0%, #0c1220 50%, #1a2f50 100%)',
                border: '1px solid rgba(255,255,255,0.09)',
                pointerEvents: 'all',
              }}
            >
              {/* Gold top accent */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent 0%, #c9a84c 40%, #e8c96d 60%, transparent 100%)' }} />

              {/* Decorative background quote mark */}
              <div
                className="absolute top-8 right-8 font-serif select-none pointer-events-none"
                style={{ fontSize: '9rem', lineHeight: 1, color: 'rgba(201,168,76,0.06)', fontWeight: 700 }}
              >
                "
              </div>

              <div className="px-10 pt-10 pb-8 relative">

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute top-5 right-5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.3rem', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                  aria-label="Close"
                >
                  ×
                </button>

                {/* Eyebrow */}
                <p
                  className="font-avenir mb-4"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#c9a84c',
                  }}
                >
                  A note of gratitude
                </p>

                {/* Headline */}
                <h2
                  className="font-avenir mb-5"
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Moved by a life well lived?
                </h2>

                {/* Body */}
                <div
                  className="font-lora mb-6 space-y-3"
                  style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75 }}
                >
                  <p>
                    The story you just read exists because someone believed it was worth preserving.
                    Justice Kay McFarland — Kansas Supreme Court Justice and the first woman elected
                    to statewide office in Kansas — held that same belief for every family.
                  </p>
                  <p>
                    Her generous gift through the McFarland Living Trust keeps Lasting Legacy Online
                    free for everyone. Now you can read the remarkable story behind that generosity.
                  </p>
                </div>

                {/* Pull quote */}
                <div
                  className="rounded-xl px-5 py-4 mb-7"
                  style={{
                    background: 'rgba(201,168,76,0.08)',
                    borderLeft: '3px solid #c9a84c',
                  }}
                >
                  <p
                    className="font-lora italic"
                    style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.65 }}
                  >
                    "Every ordinary person has an extraordinary story worth keeping."
                  </p>
                  <p
                    className="font-avenir mt-2"
                    style={{ fontSize: '0.75rem', color: '#c9a84c', letterSpacing: '0.05em' }}
                  >
                    — Justice Kay McFarland
                  </p>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleReadStory}
                    className="flex-1 font-avenir transition-all text-center"
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: '#0f1729',
                      background: 'linear-gradient(135deg, #c9a84c, #e8c96d)',
                      padding: '13px 24px',
                      borderRadius: '999px',
                      letterSpacing: '0.03em',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Read Kay McFarland's Story →
                  </button>
                  <button
                    onClick={handleClose}
                    className="font-avenir transition-all text-center"
                    style={{
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.45)',
                      padding: '13px 20px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                  >
                    Maybe later
                  </button>
                </div>

              </div>

              {/* Bottom gold line */}
              <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
