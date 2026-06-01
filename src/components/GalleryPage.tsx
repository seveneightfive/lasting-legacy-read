'use client'

import Image from 'next/image'

interface GalleryImage {
  id: number
  image_url: string
  image_title?: string | null
  image_caption?: string | null
  sort_order?: number | null
}

interface GalleryPageProps {
  title?: string | null
  images: GalleryImage[]
}

export default function GalleryPage({ title, images }: GalleryPageProps) {
  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No photos in this gallery.
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 md:px-8">
      {title && (
        <h2 className="text-xl font-medium text-gray-900 mb-5">{title}</h2>
      )}

      {/* Desktop: equal-size grid */}
      <div className="hidden md:grid grid-cols-3 gap-2">
        {images.map((img) => (
          <GalleryItem key={img.id} img={img} />
        ))}
      </div>

      {/* Mobile: horizontal scroll strip */}
      <div className="flex md:hidden gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory">
        {images.map((img) => (
          <div key={img.id} className="flex-none w-[72vw] snap-start">
            <GalleryItem img={img} mobileHeight />
          </div>
        ))}
      </div>

      {/* Mobile swipe hint — only shown when there are multiple images */}
      {images.length > 1 && (
        <p className="md:hidden text-xs text-gray-400 mt-2 text-center">
          Swipe to see all photos
        </p>
      )}
    </div>
  )
}

function GalleryItem({
  img,
  mobileHeight,
}: {
  img: GalleryImage
  mobileHeight?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-gray-100">
      {/* Fixed 4:3 aspect ratio box */}
      <div className={mobileHeight ? 'aspect-[4/3]' : 'aspect-[4/3]'}>
        {img.image_url ? (
          <Image
            src={img.image_url}
            alt={img.image_title || img.image_caption || ''}
            fill
            sizes="(max-width: 768px) 72vw, 33vw"
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Caption overlay */}
      {(img.image_title || img.image_caption) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          {img.image_title && (
            <p className="text-white text-xs font-medium leading-tight">
              {img.image_title}
            </p>
          )}
          {img.image_caption && img.image_caption !== img.image_title && (
            <p className="text-white/80 text-xs leading-tight mt-0.5">
              {img.image_caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
