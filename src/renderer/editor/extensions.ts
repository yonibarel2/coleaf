import { Extension, getSchema, type Extensions } from '@tiptap/core'
import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Heading, { type Level } from '@tiptap/extension-heading'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image from '@tiptap/extension-image'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Dropcursor, Gapcursor, UndoRedo } from '@tiptap/extensions'
import { HtmlBlock, RawBlock, RawInline, RawMark, SoftBreak } from './nodes'

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
    return { 'Shift-Enter': () => this.editor.commands.setHardBreak() }
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

const CoLeafLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
      // How the file wrote it: `[text](url)` (resource) or `<url>` (autolink); null when made
      // in the editor. Keeps `[https://x](https://x)` from being saved as `<https://x>`.
      form: { default: null, rendered: false }
    }
  }
}).configure({ openOnClick: false, linkOnPaste: false })

export interface CoLeafKeysOptions {
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

export function createExtensions(options: CoLeafKeysOptions): Extensions {
  return [
    Document,
    CoLeafParagraph,
    Text,
    CoLeafHeading,
    // Marks, outermost first: a link around bold or code is written `[**text**](url)` and
    // `` [`code`](url) ``; the other way round, the link would be lost inside the code span.
    RawMark,
    CoLeafLink,
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
    Image.configure({ inline: true, allowBase64: false }),
    CoLeafUndoRedo,
    Dropcursor,
    Gapcursor,
    HtmlBlock,
    RawBlock,
    RawInline,
    SoftBreak,
    CoLeafKeys.configure(options)
  ]
}

/** The document schema, usable without an editor (tests, conversion). */
export const schema = getSchema(createExtensions({ onLink: () => {} }))
