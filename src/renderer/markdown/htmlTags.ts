// Inline HTML as Markdown parses it: one tag, or one comment, per `html` node. Pure text work,
// no DOM, so the bridge and its tests can use it (sanitizing is editor/html.ts).

export type TagKind = 'open' | 'close' | 'void' | 'comment' | 'other'

export interface Tag {
  kind: TagKind
  /** The tag name, lowercase; empty for a comment or anything else. */
  name: string
}

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

const closeTag = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>$/
const openTag = /^<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^<>]*)?\/?>$/

/** What one piece of inline HTML is: an opening tag, a closing tag, a tag that stands alone, a comment, or something else. */
export function parseTag(html: string): Tag {
  if (html.startsWith('<!--')) return { kind: 'comment', name: '' }
  const close = closeTag.exec(html)
  if (close) return { kind: 'close', name: close[1].toLowerCase() }
  const open = openTag.exec(html)
  if (!open) return { kind: 'other', name: '' }
  const name = open[1].toLowerCase()
  return { kind: voidTags.has(name) || html.endsWith('/>') ? 'void' : 'open', name }
}

// GitHub's tag filter: these tags are shown as text, never as elements (docs/markdown-spec.md).
const disallowed =
  /<(\/?)(script|style|iframe|textarea|title|xmp|noembed|noframes|plaintext)(?=[\s>/])/gi

/** HTML with GitHub's disallowed tags turned into visible text. */
export function tagFilter(html: string): string {
  return html.replace(disallowed, '&lt;$1$2')
}
