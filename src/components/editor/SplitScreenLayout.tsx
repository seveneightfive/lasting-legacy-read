import React from 'react';

interface SplitScreenLayoutProps {
  /** Left panel (typically an ImagePicker) */
  left: React.ReactNode;
  /** Right panel (editable fields) */
  right: React.ReactNode;
  /**
   * How to align the right panel's content vertically.
   * - 'top' (default): content starts at the top
   * - 'center': content centers when short, top-aligns gracefully when long
   *
   * Used for Cover, Dedication, and Chapter Title screens where the
   * form is the visual focus.
   */
  rightAlign?: 'top' | 'center';
}

/**
 * Editor frame: image left (40%), fields right (60%).
 * On mobile: stacks vertically.
 *
 * The right column is the scroll container — children that need to stick
 * (like the rich-text toolbar) should use `position: sticky; top: 0` and
 * they'll pin to the top of the visible scroll area.
 */
export default function SplitScreenLayout({
  left, right, rightAlign = 'top',
}: SplitScreenLayoutProps) {
  return (
    <div className="md:flex md:h-[calc(100vh-130px)] md:overflow-hidden bg-white">
      {/* LEFT — image (40%) */}
      <div className="md:w-[40%] md:h-full bg-slate-50 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl h-full flex flex-col">
          {left}
        </div>
      </div>

      {/* RIGHT — fields, scrollable (60%) */}
      <div className="md:w-[60%] md:h-full md:overflow-y-auto bg-white">
        {rightAlign === 'center' ? (
          // Center using flex on a min-height container.
          // Content centers when it fits in viewport; when it grows beyond
          // the viewport, it'll naturally top-align because justify-center
          // on overflowing flex content still allows scrolling from the top.
          <div className="min-h-full flex items-center justify-center p-4 md:px-10 md:py-8">
            <div className="w-full max-w-xl">{right}</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 md:px-10 md:py-8">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}
