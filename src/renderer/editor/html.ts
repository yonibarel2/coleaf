import DOMPurify from 'dompurify'
import { parseTag, tagFilter } from '../markdown/htmlTags'
import { imageUrl } from './paths'

// HTML from a file is shown the way GitHub shows it: through a sanitizer, so scripts, styles,
// forms and event handlers never make it to the page (AGENTS.md rule 3), with GitHub's
// disallowed tags visible as text. Pictures in it load like Markdown pictures (paths.ts).

const forbidTags = [
  'style',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'link',
  'meta',
  'base',
  'object',
  'embed'
]
// GitHub drops these too; `id` would also let a page fragment collide with the app's.
const forbidAttrs = ['style', 'class', 'id']

/** Sanitized HTML for the page, with repo pictures pointed at the app's image scheme. */
export function sanitizeHtml(html: string, documentPath: string): string {
  const body = DOMPurify.sanitize(tagFilter(html), {
    FORBID_TAGS: forbidTags,
    FORBID_ATTR: forbidAttrs,
    RETURN_DOM_FRAGMENT: true
  })
  for (const image of body.querySelectorAll('img')) {
    const url = imageUrl(documentPath, image.getAttribute('src'))
    if (url) image.setAttribute('src', url)
    else image.removeAttribute('src')
    image.removeAttribute('srcset')
  }
  for (const source of body.querySelectorAll('source')) {
    const candidates = (source.getAttribute('srcset') ?? '')
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/))
      .map(([src, ...rest]) => [imageUrl(documentPath, src ?? null), ...rest])
      .filter(([url]) => url !== null)
      .map((parts) => parts.join(' '))
    if (candidates.length > 0) source.setAttribute('srcset', candidates.join(', '))
    else source.removeAttribute('srcset')
  }
  const holder = document.createElement('div')
  holder.append(body)
  return holder.innerHTML
}

/** Whether sanitized HTML shows anything at all (a comment or an anchor target shows nothing). */
export function isBlank(html: string): boolean {
  return html.trim() === ''
}

export interface InlineElement {
  tag: string
  attrs: Record<string, string>
}

// Tags that may wrap text inside a line; anything else (a `<p>` or `<div>` opened mid-line)
// is shown as a marked span, since it cannot live inside a paragraph.
const inlineTags = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'cite',
  'code',
  'del',
  'dfn',
  'em',
  'i',
  'ins',
  'kbd',
  'mark',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'time',
  'tt',
  'u',
  'var'
])

const elements = new Map<string, InlineElement | null>()

/** The element an inline opening tag makes once sanitized, or null when it is not one to show. */
export function inlineElement(open: string): InlineElement | null {
  const known = elements.get(open)
  if (known !== undefined) return known
  const { kind, name } = parseTag(open)
  let element: InlineElement | null = null
  if (kind === 'open' && inlineTags.has(name)) {
    const body = DOMPurify.sanitize(`${open}</${name}>`, {
      FORBID_TAGS: forbidTags,
      FORBID_ATTR: forbidAttrs,
      RETURN_DOM_FRAGMENT: true
    })
    const first = body.firstElementChild
    if (first && first.tagName.toLowerCase() === name) {
      const attrs = [...first.attributes].map((attribute) => [attribute.name, attribute.value])
      element = { tag: name, attrs: Object.fromEntries(attrs) }
    }
  }
  elements.set(open, element)
  return element
}
