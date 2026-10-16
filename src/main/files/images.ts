import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { resolveInside } from './project'

// Pictures a document may show from the repo, by extension, and the type they are served as.
const imageTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon']
])

/** The scheme the window loads repo pictures through: `coleaf-image://project/<tree path>`. */
export const imageScheme = 'coleaf-image'

export function imageTypeOf(path: string): string | undefined {
  return imageTypes.get(extname(path).toLowerCase())
}

/** The tree path an image URL asks for, percent-escapes decoded. */
export function imagePathOf(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent).join('/')
}

/** Reads a picture of the project. Throws for anything that is not an image inside it. */
export async function readImage(
  root: string,
  path: string
): Promise<{ bytes: Uint8Array; type: string }> {
  const type = imageTypeOf(path)
  if (!type) throw new Error(`Not an image: ${path}`)
  return { bytes: await readFile(await resolveInside(root, path)), type }
}
