import { Mark, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { emojiOf } from '../markdown/emoji'
import { FrontMatterView } from './FrontMatterView'
import { inlineElement } from './html'
import { HtmlBlockView } from './HtmlBlockView'
import { HtmlInlineView } from './HtmlInlineView'
import { MathInlineView } from './MathInlineView'

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

export interface HtmlBlockOptions {
  /** Tree path of the document, which pictures in the HTML resolve against. */
  documentPath: string
  /** Ctrl+click on a link in the HTML: the app follows it. */
  onActivateLink: (href: string) => void
}

/** A block of HTML from the file: shown sanitized (HtmlBlockView.tsx), saved as it was. */
export const HtmlBlock = Node.create<HtmlBlockOptions>({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  addOptions: () => ({ documentPath: '', onActivateLink: () => {} }),
  addAttributes: () => ({ html: markdownAttribute }),
  parseHTML: () => [{ tag: 'pre[data-html-block]' }],
  renderHTML: ({ node }) => [
    'pre',
    { 'data-html-block': '', class: 'raw raw--block raw--html' },
    String(node.attrs['html'])
  ],
  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView)
  }
})

export interface HtmlInlineOptions {
  /** Tree path of the document, which a picture's path resolves against. */
  documentPath: string
}

/** One inline HTML tag or comment with no text inside it (HtmlInlineView.tsx), saved as it was. */
export const HtmlInline = Node.create<HtmlInlineOptions>({
  name: 'htmlInline',
  group: 'inline',
  inline: true,
  atom: true,
  addOptions: () => ({ documentPath: '' }),
  addAttributes: () => ({ html: markdownAttribute }),
  parseHTML: () => [{ tag: 'code[data-html-inline]' }],
  renderHTML: ({ node }) => [
    'code',
    { 'data-html-inline': '', class: 'raw raw--inline' },
    String(node.attrs['html'])
  ],
  addNodeView() {
    return ReactNodeViewRenderer(HtmlInlineView)
  }
})

/**
 * Text between an inline opening tag and its closing tag (`H<sub>2</sub>O`): shown as that
 * element when it is one that belongs inside a line, as a marked span otherwise; the text
 * stays editable and the two tags are written back around it.
 */
export const HtmlMark = Mark.create({
  name: 'htmlMark',
  excludes: '',
  addAttributes: () => ({
    open: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-html-open') ?? '',
      renderHTML: (): Record<string, never> => ({})
    },
    close: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-html-close') ?? '',
      renderHTML: (): Record<string, never> => ({})
    },
    // Wraps with the same tags inside one another (inlineHtml.ts) stay distinct marks.
    depth: { default: 0, rendered: false }
  }),
  parseHTML: () => [{ tag: '[data-html-open]' }],
  renderHTML: ({ mark }) => {
    const open = String(mark.attrs['open'])
    const data = { 'data-html-open': open, 'data-html-close': String(mark.attrs['close']) }
    const element = inlineElement(open)
    return element
      ? [element.tag, { ...element.attrs, ...data }, 0]
      : ['span', { ...data, class: 'raw raw--mark', title: open }, 0]
  }
})

/** YAML front matter (`---` lines at the top): shown as a table (FrontMatterView.tsx), saved as it was. */
export const FrontMatter = Node.create({
  name: 'frontMatter',
  group: 'block',
  atom: true,
  addAttributes: () => ({ source: { ...sourceAttribute, default: '---\n---' } }),
  parseHTML: () => [{ tag: 'pre[data-front-matter]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'pre',
    { ...HTMLAttributes, 'data-front-matter': '', class: 'raw raw--block' },
    String(node.attrs['source'])
  ],
  addNodeView() {
    return ReactNodeViewRenderer(FrontMatterView)
  }
})

/** Any other block the editor does not edit yet: footnote, link definition, TOML front matter… */
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

/** An inline leaf the editor does not edit yet: a reference image or a footnote reference. */
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

/** An inline formula (`$E = mc^2$`): drawn with KaTeX (MathInlineView.tsx), saved as its TeX. */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    code: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-math') ?? '',
      renderHTML: (attributes: Record<string, unknown>): Record<string, string> => ({
        'data-math': String(attributes['code'])
      })
    }
  }),
  parseHTML: () => [{ tag: 'span[data-math]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    { ...HTMLAttributes, class: 'math-inline' },
    String(node.attrs['code'])
  ],
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView)
  }
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
