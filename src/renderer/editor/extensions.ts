import { Extension, getSchema, type Extensions } from '@tiptap/core'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Heading, { type Level } from '@tiptap/extension-heading'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import Italic from '@tiptap/extension-italic'
import Link, { type LinkOptions } from '@tiptap/extension-link'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Text from '@tiptap/extension-text'
import { Dropcursor, Gapcursor, UndoRedo } from '@tiptap/extensions'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { HtmlBlock, RawBlock, RawInline, RawMark, SoftBreak } from './nodes'
import { imageUrl } from './paths'

// Keyboard shortcuts follow docs/markdown-spec.md exactly. The TipTap defaults that are not in
// the spec are removed here; tests/editor/shortcuts.test.ts checks the full list.

const shortcutHeadingLevels: Level[] = [1, 2, 3]

const CoLeafHeading = Heading.extend({
  addKeyboardShortcuts() {
    return Object.fromEntries(
      shortcutHeadingLevels.map((level) => [
        `Mod-Alt-${level}`,
        () => this.editor.commands.toggleHeading({ level })
      ])
    )
  }
})

const CoLeafParagraph = Paragraph.extend({
  addKeyboardShortcuts() {
    return { 'Mod-Shift-n': () => this.editor.commands.setParagraph() }
  }
})

// Tight or loose (blank lines between items) is a property of the Markdown list: kept, not shown.
const spreadAttribute = { spread: { default: false, rendered: false } }

const CoLeafBulletList = BulletList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...spreadAttribute }
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-l': () => this.editor.commands.toggleBulletList() }
  }
})

const CoLeafOrderedList = OrderedList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...spreadAttribute }
  },
  addKeyboardShortcuts: () => ({})
})

const CoLeafListItem = ListItem.extend({
  addAttributes() {
    return { ...this.parent?.(), ...spreadAttribute }
  }
})

const CoLeafBlockquote = Blockquote.extend({ addKeyboardShortcuts: () => ({}) })

// Markdown allows code inside a link or bold (`` [`x`](url) ``, `` **`x`** ``); TipTap's Code
// would otherwise push every other mark off the same text.
const CoLeafCode = Code.extend({ excludes: '', addKeyboardShortcuts: () => ({}) })

const CoLeafCodeBlock = CodeBlock.extend({
  addAttributes() {
    // The text after the language on the opening fence (```js title="x") is kept as-is.
    return { ...this.parent?.(), meta: { default: null, rendered: false } }
  },
  addKeyboardShortcuts() {
    const keys = this.parent?.() ?? {}
    delete keys['Mod-Alt-c']
    return keys
  }
})

const CoLeafHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    // A GFM table cell is one line: Shift+Enter does nothing there.
    return {
      'Shift-Enter': () => this.editor.isActive('table') || this.editor.commands.setHardBreak()
    }
  }
})

const CoLeafUndoRedo = UndoRedo.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo()
    }
  }
})

interface CoLeafLinkOptions extends LinkOptions {
  /** Ctrl+click (Cmd on Mac) on a link: the app follows it. */
  onActivate: (href: string) => void
}

const CoLeafLink = Link.extend<CoLeafLinkOptions>({
  addOptions() {
    return { ...this.parent?.(), onActivate: () => {} } as CoLeafLinkOptions
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
      // How the file wrote it: `[text](url)` (resource) or `<url>` (autolink); null when made
      // in the editor. Keeps `[https://x](https://x)` from being saved as `<https://x>`.
      form: { default: null, rendered: false }
    }
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('coleafLinkClick'),
        props: {
          handleClick: (view, pos, event) => {
            if (!(event.ctrlKey || event.metaKey)) return false
            const node = view.state.doc.nodeAt(pos)
            const href = node?.marks.find((mark) => mark.type.name === 'link')?.attrs['href']
            if (typeof href !== 'string') return false
            this.options.onActivate(href)
            return true
          }
        }
      })
    ]
  }
}).configure({ openOnClick: false, linkOnPaste: false })

interface CoLeafImageOptions extends ImageOptions {
  /** Tree path of the document, which relative picture paths start from. */
  documentPath: string
}

// The Markdown `src` stays as written (kept in data-src); the picture itself loads through the
// app's image scheme for repo files, or directly for https (see paths.ts).
const CoLeafImage = Image.extend<CoLeafImageOptions>({
  addOptions() {
    return { ...this.parent?.(), documentPath: '' } as CoLeafImageOptions
  },
  addAttributes() {
    const { documentPath } = this.options
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-src') ?? element.getAttribute('src'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const src = typeof attributes['src'] === 'string' ? attributes['src'] : null
          return { 'data-src': src, src: imageUrl(documentPath, src) }
        }
      }
    }
  }
}).configure({ inline: true, allowBase64: false })

// GFM tables: the first row is the header, a cell is one line of inline text (one paragraph,
// no blocks), and each column may be aligned (shown, not editable yet). The table keeps the
// source it was opened from, so an untouched table is saved byte for byte (toMarkdown.ts).
const alignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement): string | null =>
    element.style.textAlign || element.getAttribute('align') || null,
  renderHTML: (attributes: Record<string, unknown>): Record<string, string> =>
    typeof attributes['align'] === 'string' ? { style: `text-align: ${attributes['align']}` } : {}
}

const CoLeafTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      source: { default: null, rendered: false },
      original: { default: null, rendered: false }
    }
  }
})

const CoLeafTableCell = TableCell.extend({
  content: 'paragraph',
  addAttributes() {
    return { ...this.parent?.(), align: alignAttribute }
  }
})

const CoLeafTableHeader = TableHeader.extend({
  content: 'paragraph',
  addAttributes() {
    return { ...this.parent?.(), align: alignAttribute }
  }
})

interface CoLeafKeysOptions {
  /** Ctrl+K: the app opens its link panel. */
  onLink: () => void
}

const CoLeafKeys = Extension.create<CoLeafKeysOptions>({
  name: 'coleafKeys',
  addOptions: () => ({ onLink: () => {} }),
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.options.onLink()
        return true
      }
    }
  }
})

export interface EditorOptions {
  /** Ctrl+K: the app opens its link panel. */
  onLink: () => void
  /** Ctrl+click on a link: the app follows it. */
  onActivateLink: (href: string) => void
  /** Tree path of the document, which pictures and links resolve against. */
  documentPath: string
}

export function createExtensions(options: EditorOptions): Extensions {
  return [
    Document,
    CoLeafParagraph,
    Text,
    CoLeafHeading,
    // Marks, outermost first: a link around bold or code is written `[**text**](url)` and
    // `` [`code`](url) ``; the other way round, the link would be lost inside the code span.
    RawMark,
    CoLeafLink.configure({ onActivate: options.onActivateLink }),
    Bold,
    Italic,
    CoLeafCode,
    CoLeafCodeBlock,
    CoLeafBlockquote,
    CoLeafBulletList,
    CoLeafOrderedList,
    CoLeafListItem,
    ListKeymap,
    CoLeafHardBreak,
    HorizontalRule,
    CoLeafImage.configure({ documentPath: options.documentPath }),
    CoLeafTable,
    TableRow,
    CoLeafTableHeader,
    CoLeafTableCell,
    CoLeafUndoRedo,
    Dropcursor,
    Gapcursor,
    HtmlBlock,
    RawBlock,
    RawInline,
    SoftBreak,
    CoLeafKeys.configure({ onLink: options.onLink })
  ]
}

const noOptions: EditorOptions = { onLink: () => {}, onActivateLink: () => {}, documentPath: '' }

/** The document schema, usable without an editor (tests, conversion). */
export const schema = getSchema(createExtensions(noOptions))
