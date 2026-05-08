// @ts-ignore - runtime import from .output
const { default: serverEntry } = await import('../.output/server/index.js')

export default async (req: Request) => {
  return serverEntry.fetch(req, {}, {})
}
