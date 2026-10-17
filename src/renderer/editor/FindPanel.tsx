import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import { countMatches, searchCommands, setSearch } from './search'

interface FindPanelProps {
  editor: Editor
  /** Start in the Replace field. */
  replaceFocus: boolean
  onClose: () => void
}

/** Find / Replace (Ctrl+F), above the sheet: the matches light up in the page as you type. */
export function FindPanel({ editor, replaceFocus, onClose }: FindPanelProps): JSX.Element {
  const [text, setText] = useState('')
  const [replacement, setReplacement] = useState('')
  const findInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const matches = useEditorState({ editor, selector: ({ editor }) => countMatches(editor) })

  useEffect(() => {
    ;(replaceFocus ? replaceInput : findInput).current?.select()
  }, [replaceFocus])

  useEffect(() => {
    setSearch(editor, text, replacement)
  }, [editor, text, replacement])

  // Closing clears the highlights.
  useEffect(() => () => setSearch(editor, '', ''), [editor])

  const close = (): void => {
    editor.commands.focus()
    onClose()
  }
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') close()
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) searchCommands.previous(editor)
      else searchCommands.next(editor)
    }
  }
  const none = matches === 0

  return (
    <div className="find-panel" role="search" onKeyDown={onKeyDown}>
      <label className="find-panel__field">
        <span>Find</span>
        <input ref={findInput} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <span className="find-panel__count" aria-live="polite">
        {text === '' ? '' : `${matches} ${matches === 1 ? 'match' : 'matches'}`}
      </span>
      <button
        type="button"
        className="button"
        data-tip="Previous (Shift+Enter)"
        aria-label="Previous match"
        disabled={none}
        onClick={() => searchCommands.previous(editor)}
      >
        <ChevronUp />
      </button>
      <button
        type="button"
        className="button"
        data-tip="Next (Enter)"
        aria-label="Next match"
        disabled={none}
        onClick={() => searchCommands.next(editor)}
      >
        <ChevronDown />
      </button>
      <label className="find-panel__field">
        <span>Replace</span>
        <input
          ref={replaceInput}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="button"
        disabled={none || !editor.isEditable}
        onClick={() => searchCommands.replace(editor)}
      >
        Replace
      </button>
      <button
        type="button"
        className="button"
        disabled={none || !editor.isEditable}
        onClick={() => searchCommands.replaceAll(editor)}
      >
        Replace all
      </button>
      <button
        type="button"
        className="button"
        aria-label="Close"
        data-tip="Close (Esc)"
        onClick={close}
      >
        <X />
      </button>
    </div>
  )
}
