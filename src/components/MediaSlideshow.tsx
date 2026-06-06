import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMediaType } from '@/lib/media'
import { optimizeImage } from '@/lib/image'

interface MediaSlideshowProps {
  media: string[]
  className?: string
  aspectRatio?: string
  autoPlayInterval?: number
  onMediaClick?: (url: string) => void
}

export function MediaSlideshow({
  media,
  className = '',
  aspectRatio = 'aspect-video',
  autoPlayInterval = 5000,
  onMediaClick,
}: MediaSlideshowProps) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (media.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % media.length)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [media.length, autoPlayInterval, isPaused])

  if (!media || media.length === 0) return null

  const current = media[index]
  const type = getMediaType(current)

  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((prev) => (prev + 1) % media.length)
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((prev) => (prev - 1 + media.length) % media.length)
  }

  return (
    <div
      className={`relative group overflow-hidden ${aspectRatio} ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="absolute inset-0 transition-all duration-500 ease-in-out">
        {type === 'video' ? (
          <video
            src={current}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            onClick={() => onMediaClick?.(current)}
          />
        ) : (
          <img
            src={optimizeImage(current, 600)}
            alt=""
            className="h-full w-full object-cover cursor-pointer"
            onClick={() => onMediaClick?.(current)}
          />
        )}
      </div>

      {media.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1.5 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/20 p-1.5 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {media.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === index ? 'bg-primary w-3' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
