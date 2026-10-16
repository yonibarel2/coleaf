import { Mark, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { Mark as PmMark } from 'prosemirror-model'
import { emojiOf } from '../markdown/emoji'
import { FrontMatterView } from './FrontMatterView'
import { inlineElement } from './html'
import { HtmlBlockView } from './HtmlBlockView'
import { HtmlInlineView } from './HtmlInlineView'
import { MathInlineView } from './MathInlineView'
import { imageUrl } from './paths'

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

/** Any other block the editor does not edit yet: link definitions, TOML front matter… */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  addAttributes: () => ({
    markdown: markdownAttribute,
    source: sourceAttribute,
    node: mdastAttribute,
    // What the block holds, when known: 'definitions' for link reference definitions, which
    // GitHub does not show at all and CoLeaf shows small and muted.
    kind: {
      default: null,
      parseHTML: (element: HTMLElement): string | null => element.getAttribute('data-kind'),
      renderHTML: (attributes: Record<string, unknown>): Record<string, string> =>
        typeof attributes['kind'] === 'string' ? { 'data-kind': attributes['kind'] } : {}
    }
  }),
  parseHTML: () => [{ tag: 'pre[data-raw-block]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'pre',
    {
      ...HTMLAttributes,
      'data-raw-block': '',
      class: `raw raw--block${node.attrs['kind'] === 'definitions' ? ' raw--definitions' : ''}`
    },
    String(node.attrs['markdown'])
  ]
})

interface MdastReference {
  type?: string
  url?: string
  alt?: string | null
  label?: string | null
  data?: { coleafUrl?: string | null; literal?: boolean }
}

export interface RawInlineOptions {
  /** Tree path of the document, which a reference picture's path resolves against. */
  documentPath: string
}

/** An inline leaf the editor does not edit yet: a reference image (`![alt][label]`), shown as its picture. */
export const RawInline = Node.create<RawInlineOptions>({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  addOptions: () => ({ documentPath: '' }),
  addAttributes: () => ({
    markdown: markdownAttribute,
    source: sourceAttribute,
    node: mdastAttribute
  }),
  parseHTML: () => [{ tag: '[data-raw-inline]' }],
  renderHTML({ node, HTMLAttributes }) {
    const mdast = node.attrs['node'] as MdastReference | null
    const url = mdast?.type === 'imageReference' ? mdast.data?.coleafUrl : null
    if (typeof url === 'string') {
      const src = imageUrl(this.options.documentPath, url)
      return [
        'img',
        {
          ...HTMLAttributes,
          'data-raw-inline': '',
          src,
          alt: mdast?.alt ?? '',
          title: node.attrs['markdown']
        }
      ]
    }
    return [
      'code',
      { ...HTMLAttributes, 'data-raw-inline': '', class: 'raw raw--inline' },
      String(node.attrs['markdown'])
    ]
  }
})

/** The address a mark points at: a link, an inline HTML `<a href>`, a reference link or a bare URL. */
export function hrefOfMark(mark: PmMark): string | null {
  if (mark.type.name === 'link') {
    return typeof mark.attrs['href'] === 'string' ? mark.attrs['href'] : null
  }
  if (mark.type.name === 'htmlMark') {
    const element = inlineElement(String(mark.attrs['open']))
    return element?.tag === 'a' ? (element.attrs['href'] ?? null) : null
  }
  if (mark.type.name === 'rawMark') {
    const mdast = mark.attrs['node'] as MdastReference | null
    if (mdast?.type === 'link') return mdast.url ?? null
    if (mdast?.type === 'linkReference') return mdast.data?.coleafUrl ?? null
  }
  return null
}

/**
 * An inline wrapper the editor does not edit yet: a reference link (`[text][label]`) or a
 * bare URL, shown as a link; its text stays editable and it is written back as it was.
 */
export const RawMark = Mark.create({
  name: 'rawMark',
  addAttributes: () => ({ node: mdastAttribute }),
  parseHTML: () => [{ tag: '[data-raw-mark]' }],
  renderHTML: ({ mark, HTMLAttributes }) => {
    const href = hrefOfMark(mark)
    return href === null
      ? ['span', { ...HTMLAttributes, 'data-raw-mark': '', class: 'raw raw--mark' }, 0]
      : ['a', { ...HTMLAttributes, 'data-raw-mark': '', class: 'raw raw--link', href }, 0]
  }
})

/** A footnote reference (`Text[^1]`): a superscript label, written back as it was. */
export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    identifier: { default: '', rendered: false },
    label: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-footnote') ?? '',
      renderHTML: (): Record<string, never> => ({})
    }
  }),
  parseHTML: () => [{ tag: 'sup[data-footnote]' }],
  renderHTML: ({ node }) => {
    const label = String(node.attrs['label'])
    return [
      'sup',
      { 'data-footnote': label, class: 'footnote-ref', title: `Footnote ${label}` },
      label
    ]
  }
})

/** A footnote's text (`[^1]: The note.`): a small block with its label; the text is editable. */
export const FootnoteDef = Node.create({
  name: 'footnoteDef',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes: () => ({
    identifier: { default: '', rendered: false },
    label: {
      default: '',
      parseHTML: (element: HTMLElement): string => element.getAttribute('data-footnote-def') ?? '',
      renderHTML: (attributes: Record<string, unknown>): Record<string, string> => ({
        'data-footnote-def': String(attributes['label'])
      })
    }
  }),
  parseHTML: () => [{ tag: 'div[data-footnote-def]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { ...HTMLAttributes, class: 'footnote' }, 0],
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'footnote'
      const label = document.createElement('span')
      label.className = 'footnote__label'
      label.contentEditable = 'false'
      const content = document.createElement('div')
      content.className = 'footnote__content'
      dom.append(label, content)
      const apply = (current: typeof node): void => {
        label.textContent = String(current.attrs['label'])
      }
      apply(node)
      return {
        dom,
        contentDOM: content,
        update: (updated) => {
          if (updated.type !== node.type) return false
          apply(updated)
          return true
        }
      }
    }
  }
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
