import { Check, Code } from 'lucide-react'
import type { JSX } from 'react'

// Blocks shown as something other than their text (front matter, HTML) carry an "Edit code"
// button in their corner; it swaps the view for the block's source in a field, with Done to
// come back. The same corner holds a code block's language picker (CodeBlockView.tsx).

interface EditCodeButtonProps {
  onClick: () => void
}

export function EditCodeButton({ onClick }: EditCodeButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className="code-block__edit"
      contentEditable={false}
      title="Edit code"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Code />
      <span>Edit code</span>
    </button>
  )
}

interface CodeEditorProps {
  /** What the field holds: the block's exact source. */
  value: string
  label: string
  onChange: (value: string) => void
  onDone: () => void
}

/** The block's source in a field; Done, or Escape, closes it. */
export function CodeEditor({ value, label, onChange, onDone }: CodeEditorProps): JSX.Element {
  return (
    <div className="code-editor" contentEditable={false}>
      <button
        type="button"
        className="code-block__edit"
        title="Done"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDone}
      >
        <Check />
        <span>Done</span>
      </button>
      <textarea
        className="code-editor__field"
        value={value}
        rows={Math.min(20, value.split('\n').length + 1)}
        autoFocus
        spellCheck={false}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onDone()
          }
        }}
      />
    </div>
  )
}
