/**
 * Detects the media type from a URL or filename extension.
 * Returns 'video', 'gif', or 'image'.
 */
export function getMediaType(url: string): 'video' | 'gif' | 'image' {
  if (!url) return 'image'
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video'
  if (ext === 'gif') return 'gif'
  return 'image'
}

/**
 * Returns true if the file should bypass client-side WebP compression.
 * Videos and GIFs should be uploaded as-is.
 */
export function shouldBypassCompression(file: File): boolean {
  return file.type.startsWith('video/') || file.type === 'image/gif'
}

/**
 * Reads any file as a base64 string (no compression/conversion).
 * Used for videos and GIFs which must be uploaded raw.
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (!result) return reject(new Error('Failed to read file'))
      resolve(result.split(',')[1]) // strip the data:...;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const VIDEO_MAX_SIZE = 50 * 1024 * 1024 // 50 MB
export const IMAGE_MAX_SIZE = 4 * 1024 * 1024 // 4 MB
