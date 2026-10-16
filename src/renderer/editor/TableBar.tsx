import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import type { JSX } from 'react'

interface Place {
  /** Offsets of the table inside the scrolling page area. */
  top: number
  left: number
  /** The cursor is in the header row: it cannot get a row above it or be deleted. */
  inHeader: boolean
}

// Where the table under the cursor sits, or null when the cursor is not in a table.
function tablePlace(editor: Editor): Place | null {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== 'table') continue
    const dom = editor.view.nodeDOM($from.before(depth))
    const container = editor.view.dom.closest('.editor')
    if (!(dom instanceof HTMLElement) || !container) return null
    const rect = dom.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    return {
      top: rect.top - box.top + container.scrollTop,
      left: rect.left - box.left + container.scrollLeft,
      inHeader: $from.index(depth) === 0
    }
  }
  return null
}

/** A small bar above the table the cursor is in: rows and columns in and out. */
export function TableBar({ editor }: { editor: Editor }): JSX.Element | null {
  const place = useEditorState({ editor, selector: ({ editor }) => tablePlace(editor) })
  if (!place) return null
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()
  const actions = [
    { label: 'Row above', run: () => chain().addRowBefore().run(), disabled: place.inHeader },
    { label: 'Row below', run: () => chain().addRowAfter().run() },
    { label: 'Column left', run: () => chain().addColumnBefore().run() },
    { label: 'Column right', run: () => chain().addColumnAfter().run() },
    { label: 'Delete row', run: () => chain().deleteRow().run(), disabled: place.inHeader },
    { label: 'Delete column', run: () => chain().deleteColumn().run() },
    { label: 'Delete table', run: () => chain().deleteTable().run() }
  ]
  return (
    <div
      className="table-bar"
      role="toolbar"
      aria-label="Table"
      style={{ top: place.top, left: place.left }}
      onMouseDown={(event) => event.preventDefault()} // keeps the cursor in the table
    >
      {actions.map(({ label, run, disabled }) => (
        <button
          key={label}
          type="button"
          className="table-bar__button"
          disabled={disabled}
          onClick={run}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
