// @ts-ignore
import serverEntry from '../dist/server/server.js'

export default async (req: Request) => {
  return serverEntry.fetch(req, {}, {})
}
