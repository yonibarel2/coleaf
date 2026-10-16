// Paths inside the project, as links and pictures in a document name them: relative to the
// document's folder, or from the project root when they start with `/`, like on GitHub.

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
