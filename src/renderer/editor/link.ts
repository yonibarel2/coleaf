import type { Editor } from '@tiptap/core'
import type { LinkDraft } from './LinkPanel'

/** What the link panel starts with: the selected text, and the link under the cursor if any. */
export function linkDraftFor(editor: Editor): LinkDraft {
  const href = editor.getAttributes('link')['href']
  if (typeof href === 'string') editor.commands.extendMarkRange('link')
  const { from, to } = editor.state.selection
  return {
    text: editor.state.doc.textBetween(from, to),
    href: typeof href === 'string' ? href : ''
  }
}

/** Puts a link in the document: over the selection, or replacing the link under the cursor. */
export function insertLink(editor: Editor, { text, href }: LinkDraft): void {
  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
    .run()
}
