import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { isHiddenName, isMarkdownName, resolveInside } from './project'

/** The folder CoLeaf owns for pictures; only files under it are ever cleaned up. */
export const imagesFolder = 'md-images'

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

/** Where a document's pictures go: `md-images/` plus the document's path without its extension. */
export function imageFolderOf(documentPath: string): string {
  return `${imagesFolder}/${documentPath.replace(/\.(md|markdown)$/i, '')}`
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

/**
 * Pictures under `md-images/` that no Markdown file of the project shows or links to. Every
 * `.md` is read (Git's folder, system clutter and `node_modules` skipped); targets resolve the
 * way the window resolves them: relative to the document, or from the root after a `/`. Letter
 * case is ignored, so a link GitHub would break still keeps its picture.
 */
export async function unusedImages(root: string): Promise<string[]> {
  const pictures = await listFiles(root, imagesFolder, (name) => imageTypeOf(name) !== undefined)
  if (pictures.length === 0) return []
  const used = new Set<string>()
  for (const document of await listFiles(root, '', isMarkdownName)) {
    const text = await readFile(join(root, ...document.split('/')), 'utf8').catch(() => '')
    for (const target of targetsIn(text)) {
      const path = resolveTarget(document, target)
      if (path) used.add(path.toLowerCase())
    }
  }
  return pictures.filter((picture) => !used.has(picture.toLowerCase()))
}

/** Deletes pictures under `md-images/` (nowhere else), and the folders left empty. */
export async function removeImages(root: string, paths: string[]): Promise<void> {
  for (const path of paths) {
    if (!path.startsWith(`${imagesFolder}/`) || !imageTypeOf(path)) {
      throw new Error(`Not a picture of ${imagesFolder}: ${path}`)
    }
    const file = await resolveInside(root, path)
    await rm(file, { force: true })
    for (let dir = dirname(file); dir.length > root.length; dir = dirname(dir)) {
      try {
        await rmdir(dir) // only an empty folder goes
      } catch {
        break
      }
    }
  }
}

// Tree paths of the files under a folder that pass the filter, at any depth.
async function listFiles(
  root: string,
  dir: string,
  keep: (name: string) => boolean
): Promise<string[]> {
  const files: string[] = []
  let dirents
  try {
    dirents = await readdir(join(root, ...dir.split('/').filter(Boolean)), { withFileTypes: true })
  } catch {
    return files
  }
  for (const dirent of dirents) {
    if (isHiddenName(dirent.name) || dirent.name === 'node_modules') continue
    const path = dir ? `${dir}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) files.push(...(await listFiles(root, path, keep)))
    else if (dirent.isFile() && keep(dirent.name)) files.push(path)
  }
  return files.sort()
}

// Everything a Markdown text may point a picture at: image and link targets, reference
// definitions, and `src` or `href` in HTML. Over-matching is fine: it only keeps a picture.
function targetsIn(text: string): string[] {
  const targets: string[] = []
  for (const match of text.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]*)>|([^\s)]+))/g)) {
    targets.push(match[1] ?? match[2])
  }
  for (const match of text.matchAll(/^ {0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/gm)) {
    targets.push(match[1] ?? match[2])
  }
  for (const match of text.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    targets.push(match[1] ?? match[2] ?? match[3])
  }
  return targets
}

// The tree path a target names, by the window's rule (editor/paths.ts): null for a web address
// or a path that leaves the project.
function resolveTarget(documentPath: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null
  let path = target.split(/[?#]/, 1)[0]
  try {
    path = decodeURIComponent(path)
  } catch {
    return null
  }
  if (path === '') return null
  const segments = path.startsWith('/') ? [] : documentPath.split('/').slice(0, -1)
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(part)
  }
  return segments.length > 0 ? segments.join('/') : null
}
