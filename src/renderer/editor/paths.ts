// Paths inside the project, as links and pictures in a document name them: relative to the
// document's folder, or from the project root when they start with `/`, like on GitHub.

/** Whether a tree path names a file CoLeaf edits (`.md`, `.markdown`). */
export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

/**
 * The tree path a link or picture target points at, or null when it leaves the project. A
 * query or fragment is dropped and percent-escapes are decoded.
 */
export function resolveRepoPath(documentPath: string, target: string): string | null {
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

/** How a document links to another tree path: `docs/plan.md` → `md-images/docs/plan/a.png` is `../md-images/docs/plan/a.png`. */
export function relativePath(documentPath: string, treePath: string): string {
  const from = documentPath.split('/').slice(0, -1)
  const to = treePath.split('/')
  let common = 0
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++
  return [...Array<string>(from.length - common).fill('..'), ...to.slice(common)].join('/')
}

/**
 * Where the window loads a picture from: an `https` address as it is, a repo file through the
 * app's image scheme (served from inside the project only, see main/files/images.ts). Anything
 * else is not shown; the browser shows the alt text instead.
 */
export function imageUrl(documentPath: string, src: string | null): string | null {
  if (!src) return null
  if (/^https:\/\//i.test(src)) return src
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null
  const path = resolveRepoPath(documentPath, src)
  if (!path) return null
  return `coleaf-image://project/${path.split('/').map(encodeURIComponent).join('/')}`
}
