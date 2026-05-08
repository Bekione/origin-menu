// @ts-ignore
import serverEntry from '../.output/server/index.js'

export default async (req: Request) => {
  return serverEntry.fetch(req, {}, {})
}
