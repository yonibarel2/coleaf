import { readdir, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { TreeEntry } from '../../preload/contract'

// Never shown in the tree: Git internals and operating-system clutter.
const hiddenNames = new Set([
  '.git',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '$RECYCLE.BIN',
  'System Volume Information',
  '.Spotlight-V100',
  '.Trashes'
])

// Windows and macOS file systems ignore letter case; Linux does not.
const ignoresCase = process.platform === 'win32' || process.platform === 'darwin'

export function isHiddenName(name: string): boolean {
  return hiddenNames.has(name)
}

export function isMarkdownName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name)
}

/** Folders first, then files, each in natural, case-insensitive order. */
export function compareEntries(a: TreeEntry, b: TreeEntry): number {
  if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Turns a tree path into an absolute path, or throws when it would leave the project folder.
 * The real paths are compared too, so a link inside the project cannot point outside it.
 */
export async function resolveInside(root: string, path: string): Promise<string> {
  const outside = new Error(`Path is outside the project: ${path}`)
  if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw outside
  const target = resolve(root, path)
  const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)])
  if (!isInside(realRoot, realTarget)) throw outside
  return target
}

function isInside(root: string, target: string): boolean {
  const between = ignoresCase
    ? relative(root.toLowerCase(), target.toLowerCase())
    : relative(root, target)
  return (
    between === '' || (!isAbsolute(between) && between !== '..' && !between.startsWith(`..${sep}`))
  )
}

/** Lists one folder of the project: hidden entries removed, folders first. */
export async function listDirectory(root: string, path: string): Promise<TreeEntry[]> {
  const dir = await resolveInside(root, path)
  const entries: TreeEntry[] = []
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    if (isHiddenName(dirent.name)) continue
    const kind = dirent.isDirectory()
      ? 'dir'
      : dirent.isFile()
        ? 'file'
        : await kindOfLink(join(dir, dirent.name))
    if (!kind) continue
    entries.push({
      name: dirent.name,
      path: path ? `${path}/${dirent.name}` : dirent.name,
      kind,
      isMarkdown: kind === 'file' && isMarkdownName(dirent.name)
    })
  }
  return entries.sort(compareEntries)
}

// A link shows as whatever it points to; a broken link is left out.
async function kindOfLink(path: string): Promise<TreeEntry['kind'] | undefined> {
  try {
    const info = await stat(path)
    return info.isDirectory() ? 'dir' : info.isFile() ? 'file' : undefined
  } catch {
    return undefined
  }
}
