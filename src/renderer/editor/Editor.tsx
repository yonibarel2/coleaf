import { EditorContent } from '@tiptap/react'
import type { JSX } from 'react'
import type { Tab } from '../tabs/useTabs'
import { insertLink } from './link'
import { LinkPanel, type LinkDraft } from './LinkPanel'
import { TableBar } from './TableBar'
import './editor.css'

interface EditorProps {
  tab: Tab
  linkDraft: LinkDraft | null
  onLinkDone: () => void
}

/** The document sheet of the active tab, with the link panel when it is open. */
export function Editor({ tab, linkDraft, onLinkDone }: EditorProps): JSX.Element {
  return (
    <div className="editor">
      {tab.readOnly && (
        <p className="notice">
          This file is not UTF-8 text. It is shown read-only and will never be rewritten.
        </p>
      )}
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
