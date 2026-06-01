// ─────────────────────────────────────────────────────────────
// EDITOR TOGGLE — add this wherever your page settings panel is
// (the component that saves page.subtitle, page.quote, etc.)
// ─────────────────────────────────────────────────────────────

// 1. In your page editor state, make sure gallery_page is included:
//    const [galleryPage, setGalleryPage] = useState(page.gallery_page ?? false)

// 2. In your save/update function, include it in the upsert:
//    { ...otherFields, gallery_page: galleryPage }

// 3. Drop this toggle anywhere in the editor UI — recommended near
//    the image/layout settings section:

function GalleryPageToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
          focus:ring-blue-500 focus:ring-offset-1
          ${value ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${value ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>

      {/* Label */}
      <span className="text-sm text-gray-700">
        Gallery page
        <span className="block text-xs text-gray-400 font-normal">
          Shows all photos in a full-width grid instead of the split layout
        </span>
      </span>
    </label>
  )
}

export default GalleryPageToggle
