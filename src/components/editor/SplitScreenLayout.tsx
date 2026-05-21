import React from 'react';

interface SplitScreenLayoutProps {
  /** Left panel (typically an ImagePicker) */
  left: React.ReactNode;
  /** Right panel (editable fields) */
  right: React.ReactNode;
  /** Optional breadcrumb shown above the right panel */
  breadcrumb?: React.ReactNode;
}

/**
 * The recurring editor frame: image on the left, fields on the right.
 * Mirrors the reader's split-screen so editors see what readers see.
 *
 * On mobile: stacks vertically (image first, then fields).
 */
export default function SplitScreenLayout({
  left, right, breadcrumb,
}: SplitScreenLayoutProps) {
  return (
    <div className="md:flex md:h-[calc(100vh-120px)] md:overflow-hidden bg-white">
      {/* LEFT — image */}
      <div className="md:w-[45%] md:h-full bg-slate-50 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl h-full flex flex-col">
          {left}
        </div>
      </div>

      {/* RIGHT — fields, scrollable */}
      <div className="md:w-[55%] md:h-full md:overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:px-10 md:py-8">
          {breadcrumb && (
            <div className="mb-4 text-xs text-slate-400 font-avenir uppercase tracking-wider">
              {breadcrumb}
            </div>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}
