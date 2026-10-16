import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
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

/** Where a document's pictures go: `images/` plus the document's path without its extension. */
export function imageFolderOf(documentPath: string): string {
  return `images/${documentPath.replace(/\.(md|markdown)$/i, '')}`
}

/**
 * A file name safe to create: the base name only, odd characters replaced, an image extension
 * required. The clipboard's `image.png` becomes `picture.png`, numbered when stored.
 */
export function safeImageName(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+(?=\.)/g, '')
    .replace(/^[-.]+|-+$/g, '')
  if (!imageTypeOf(cleaned)) return null
  return /^image\./i.test(cleaned) ? cleaned.replace(/^image/i, 'picture') : cleaned
}

// The first name not taken: the name itself, then name-2, name-3…; clipboard pictures are
// always numbered (picture-1, picture-2…), as the plan shows them.
function freeName(dir: string, name: string): string {
  const extension = extname(name)
  const stem = name.slice(0, name.length - extension.length)
  const taken = (candidate: string): boolean => existsSync(join(dir, candidate))
  if (stem !== 'picture' && !taken(name)) return name
  for (let n = stem === 'picture' ? 1 : 2; ; n++) {
    const candidate = `${stem}-${n}${extension}`
    if (!taken(candidate)) return candidate
  }
}

/**
 * Stores picture bytes beside the document's other pictures (the folder is created with the
 * first one) and returns the tree path. Never replaces a file.
 */
export async function storeImage(
  root: string,
  documentPath: string,
  name: string,
  bytes: Uint8Array
): Promise<string> {
  const safe = safeImageName(name)
  if (!safe) throw new Error(`Not an image: ${name}`)
  await resolveInside(root, documentPath) // the document itself must be inside the project
  const folder = imageFolderOf(documentPath)
  const dir = resolve(root, ...folder.split('/'))
  await mkdir(dir, { recursive: true })
  const file = freeName(dir, safe)
  await writeFile(join(dir, file), bytes, { flag: 'wx' })
  return `${folder}/${file}`
}

/** Copies a picture from anywhere on disk (Insert › Picture) beside the document's pictures. */
export async function importImage(
  root: string,
  documentPath: string,
  source: string
): Promise<string> {
  return storeImage(root, documentPath, basename(source), await readFile(source))
}
