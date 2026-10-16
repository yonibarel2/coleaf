import { EditorContent } from '@tiptap/react'
import type { JSX } from 'react'
import type { Tab } from '../tabs/useTabs'
import { FindPanel } from './FindPanel'
import { insertLink } from './link'
import { LinkPanel, type LinkDraft } from './LinkPanel'
import { TableBar } from './TableBar'
import './editor.css'

interface EditorProps {
  tab: Tab
  linkDraft: LinkDraft | null
  onLinkDone: () => void
  /** Find / Replace is open, starting in Find or in Replace. */
  find: { replace: boolean } | null
  onFindDone: () => void
}

/** The document sheet of the active tab, with the link or find panel when one is open. */
export function Editor({ tab, linkDraft, onLinkDone, find, onFindDone }: EditorProps): JSX.Element {
  return (
    <div className="editor">
      {tab.readOnly && (
        <p className="notice">
          This file is not UTF-8 text. It is shown read-only and will never be rewritten.
        </p>
      )}
      {find && <FindPanel editor={tab.editor} replaceFocus={find.replace} onClose={onFindDone} />}
      {linkDraft && (
        <LinkPanel
          draft={linkDraft}
          onInsert={(link) => {
            insertLink(tab.editor, link)
            onLinkDone()
          }}
          onCancel={() => {
            tab.editor.commands.focus()
            onLinkDone()
          }}
        />
      )}
      <EditorContent editor={tab.editor} className="sheet" />
      <TableBar editor={tab.editor} />
    </div>
  )
}
