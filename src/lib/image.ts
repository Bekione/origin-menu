/**
 * Stubbed optimization (Supabase image transform requires Pro Plan).
 * We instead rely on client-side compression on upload.
 */
export function optimizeImage(
  originalUrl: string,
  _width: number = 400,
): string {
  if (!originalUrl || typeof originalUrl !== 'string') return originalUrl
  return originalUrl
}

/**
 * Compresses an image file natively via HTML5 Canvas before upload.
 * It resizes the maximum dimension to `maxWidthOrHeight` maintaining aspect ratio,
 * and encodes it as WebP at `quality`.
 */
export async function compressImageFile(
  file: File,
  maxWidthOrHeight = 800,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width)
            width = maxWidthOrHeight
          } else {
            width = Math.round((width * maxWidthOrHeight) / height)
            height = maxWidthOrHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error('Canvas context could not be created'))
        }

        ctx.drawImage(img, 0, 0, width, height)
        // Export to WebP for excellent compression
        const dataUrl = canvas.toDataURL('image/webp', quality)
        resolve(dataUrl.split(',')[1]) // Return raw base64 string
      }
      img.onerror = () =>
        reject(new Error('Failed to load image for compression'))
      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read wrapper'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
