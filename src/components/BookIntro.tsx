import React from 'react';
import { motion } from 'framer-motion';
import { marked } from 'marked';

interface BookIntroProps {
  intro: string;
  introImageUrl?: string | null;
  introImageCaption?: string | null;
  onNext: () => void;
  onPrevious: () => void;
}

export default function BookIntro({
  intro,
  introImageUrl,
  introImageCaption,
  onNext,
  onPrevious,
}: BookIntroProps) {
  const hasImage = Boolean(introImageUrl);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-slate-50 flex items-center justify-center p-8"
    >
      <div className={hasImage ? 'max-w-6xl w-full mx-auto' : 'max-w-3xl mx-auto'}>
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {hasImage ? (
            <div className="grid md:grid-cols-[2fr_3fr] gap-12 items-start mb-12">
              {/* Left: photo + caption */}
              <figure className="md:sticky md:top-12">
                <img
                  src={introImageUrl ?? undefined}
                  alt={introImageCaption ?? 'Introduction photo'}
                  className="w-full h-auto rounded-lg shadow-md object-cover"
                />
                {introImageCaption && (
                  <figcaption className="image-caption mt-3">
                    {introImageCaption}
                  </figcaption>
                )}
              </figure>

              {/* Right: heading + intro text */}
              <div>
                <h2 className="text-3xl font-avenir text-slate-800 mb-8 heading-tracking">
                  Introduction
                </h2>
                <div
                  className="text-body-large font-lora leading-body-relaxed markdown-body"
                  dangerouslySetInnerHTML={{ __html: marked.parse(intro) }}
                />
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-avenir text-slate-800 mb-8 text-center heading-tracking">
                Introduction
              </h2>
              <div className="max-w-none mb-12 px-8">
                <div
                  className="text-body-large font-lora leading-body-relaxed markdown-body"
                  dangerouslySetInnerHTML={{ __html: marked.parse(intro) }}
                />
              </div>
            </>
          )}

          <div className="flex justify-between">
            <button
              onClick={onPrevious}
              className="px-6 py-2 font-avenir text-slate-600 hover:text-slate-800 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-slate-800 text-white rounded-full font-avenir hover:bg-slate-900 transition-colors"
            >
              Start Chapter 1 →
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
