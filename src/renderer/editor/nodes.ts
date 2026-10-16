import { Mark, Node } from '@tiptap/core'
import { emojiOf } from '../markdown/emoji'

// Markdown the editor cannot edit yet is carried through as-is and written back unchanged: as
// its exact source text when it has one, else as the mdast node it came from. Shown as code for
// now (see docs/plan.md, Stage 1b).

// Attribute holding an mdast node: in the DOM only as JSON, for copy and paste.
const mdastAttribute = {
  default: null,
  parseHTML: (element: HTMLElement): unknown =>
    JSON.parse(element.getAttribute('data-node') ?? 'null'),
  renderHTML: (attributes: Record<string, unknown>): Record<string, string> =>
    attributes['node'] == null ? {} : { 'data-node': JSON.stringify(attributes['node']) }
}

// Attribute holding the exact source text, when the node has one.
const sourceAttribute = {
  default: null,
  parseHTML: (element: HTMLElement): string | null => element.getAttribute('data-source'),
  renderHTML: (attributes: Record<string, unknown>): Record<string, string> =>
    typeof attributes['source'] === 'string' ? { 'data-source': attributes['source'] } : {}
}

// The Markdown shown as the node's text; never an attribute in the DOM.
const markdownAttribute = {
  default: '',
  parseHTML: (element: HTMLElement): string => element.textContent ?? '',
  renderHTML: (): Record<string, never> => ({})
}

/** A block of raw HTML from the file. */
export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  addAttributes: () => ({ html: markdownAttribute }),
  parseHTML: () => [{ tag: 'pre[data-html-block]' }],
  renderHTML: ({ node }) => [
    'pre',
    { 'data-html-block': '', class: 'raw raw--block raw--html' },
    String(node.attrs['html'])
  ]
})

/** Any other block the editor does not edit yet: task list, footnote, link definition, front matter… */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  addAttributes: () => ({
    markdown: markdownAttribute,
    source: sourceAttribute,
    node: mdastAttribute
  }),
  parseHTML: () => [{ tag: 'pre[data-raw-block]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'pre',
    { ...HTMLAttributes, 'data-raw-block': '', class: 'raw raw--block' },
    String(node.attrs['markdown'])
  ]
})

/** An inline leaf the editor does not edit yet: inline HTML, image or footnote reference… */
export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    markdown: markdownAttribute,
    source: sourceAttribute,
    node: mdastAttribute
  }),
  parseHTML: () => [{ tag: 'code[data-raw-inline]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'code',
    { ...HTMLAttributes, 'data-raw-inline': '', class: 'raw raw--inline' },
    String(node.attrs['markdown'])
  ]
})

/** An inline wrapper the editor does not edit yet (reference link, strikethrough): its text stays editable. */
export const RawMark = Mark.create({
  name: 'rawMark',
  addAttributes: () => ({ node: mdastAttribute }),
  parseHTML: () => [{ tag: 'span[data-raw-mark]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    { ...HTMLAttributes, 'data-raw-mark': '', class: 'raw raw--mark' },
    0
  ]
})

/** An emoji shortcode (`:smile:`): shown as the emoji, saved as the shortcode. */
export const Emoji = Node.create({
  name: 'emoji',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    name: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-emoji') ?? '',
      renderHTML: (): Record<string, never> => ({})
    }
  }),
  parseHTML: () => [{ tag: 'span[data-emoji]' }],
  renderHTML: ({ node }) => {
    const name = String(node.attrs['name'])
    return ['span', { 'data-emoji': name, class: 'emoji', title: `:${name}:` }, emojiOf(name) ?? '']
  }
})

/**
 * A line break inside a paragraph that Markdown shows as a space. Kept as a node so a wrapped
 * paragraph is saved with its original line breaks (Prettier's "preserve"), not as one long line.
 */
export const SoftBreak = Node.create({
  name: 'softBreak',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: 'span[data-soft-break]' }],
  renderHTML: () => ['span', { 'data-soft-break': '', class: 'soft-break' }, ' ']
})
