import { EditorContent, useEditor } from '@tiptap/react'
import { useMemo, useState, type JSX } from 'react'
import type { ConflictChoice, ConflictPart } from '../../preload/contract'
import { createExtensions, schema } from '../editor/extensions'
import { markdownToDoc } from '../markdown/toDoc'
import './conflict.css'

interface ConflictTabProps {
  path: string
  parts: ConflictPart[]
  onDone: (choices: ConflictChoice[]) => void
}

/**
 * A conflicted Markdown file as two formatted pages, Mine and Theirs, with the parts that
 * differ highlighted. One part at a time gets Mine, Theirs or Both; Done writes the choices.
 * See docs/ui/sync-and-conflict.png.
 */
export function ConflictTab({ path, parts, onDone }: ConflictTabProps): JSX.Element {
  // Each part with its place among the conflicts (-1 for shared text).
  const numbered = useMemo(() => {
    let seen = 0
    return parts.map((part) => ({ part, index: part.kind === 'conflict' ? seen++ : -1 }))
  }, [parts])
  const count = numbered.filter(({ index }) => index >= 0).length
  const [choices, setChoices] = useState<(ConflictChoice | null)[]>(() =>
    Array.from({ length: count }, () => null)
  )
  const [current, setCurrent] = useState(0)
  const name = path.slice(path.lastIndexOf('/') + 1)
  const chosen = choices.filter((choice) => choice !== null).length

  function choose(choice: ConflictChoice): void {
    setChoices((all) => all.map((value, index) => (index === current ? choice : value)))
    // On to the next part still waiting for a choice, if any.
    const next = choices.findIndex((value, index) => index !== current && value === null)
    if (next !== -1) setCurrent(next)
  }

  const side = (title: string, which: 'mine' | 'theirs'): JSX.Element => (
    <section className="conflict__side">
      <h2 className="conflict__title">{title}</h2>
      <div className="conflict__sheet">
        {numbered.map(({ part, index }, position) => {
          if (part.kind === 'same') return <Segment key={position} text={part.text} />
          const choice = choices[index]
          const kept = choice === null || choice === 'both' || choice === which
          const classes = ['conflict__part']
          if (index === current) classes.push('conflict__part--current')
          if (!kept) classes.push('conflict__part--dropped')
          return (
            <div
              key={position}
              className={classes.join(' ')}
              role="button"
              tabIndex={0}
              aria-pressed={index === current}
              onClick={() => setCurrent(index)}
            >
              <Segment text={part[which]} />
            </div>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="conflict">
      <div className="conflict__banner">
        <span>
          {count === 1 ? '1 conflict' : `${count} conflicts`} in {name}. Choose a version for each
          highlighted part, then press Done.
        </span>
        <button
          type="button"
          className="button button--primary"
          disabled={chosen < count}
          onClick={() => onDone(choices as ConflictChoice[])}
        >
          Done
        </button>
      </div>
      <div className="conflict__sides">
        {side('Mine', 'mine')}
        {side('Theirs', 'theirs')}
      </div>
      <div className="conflict__bar">
        {count > 1 && (
          <span className="conflict__step">
            <button
              type="button"
              className="button"
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
              aria-label="Previous part"
            >
              ‹
            </button>
            Part {current + 1} of {count}
            <button
              type="button"
              className="button"
              disabled={current === count - 1}
              onClick={() => setCurrent(current + 1)}
              aria-label="Next part"
            >
              ›
            </button>
          </span>
        )}
        <span className="conflict__keep">Highlighted part · keep:</span>
        {(['mine', 'theirs', 'both'] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            className={`button${choices[current] === choice ? ' button--primary' : ''}`}
            onClick={() => choose(choice)}
          >
            {choice === 'mine' ? 'Mine' : choice === 'theirs' ? 'Theirs' : 'Both'}
          </button>
        ))}
      </div>
    </div>
  )
}

// A run of lines shown formatted and read-only. `useEditor` owns the editor's lifetime, so
// React's development double-mount does not destroy it.
function Segment({ text }: { text: string }): JSX.Element {
  const editor = useEditor(
    {
      extensions: createExtensions({
        onLink: () => {},
        onFind: () => {},
        onActivateLink: () => {},
        savePicture: () => Promise.reject(new Error('read only')),
        documentPath: ''
      }),
      content: markdownToDoc(text, schema).toJSON(),
      editable: false,
      enableInputRules: false,
      enablePasteRules: false,
      editorProps: { attributes: { class: 'document document--segment' } }
    },
    [text]
  )
  return <EditorContent editor={editor} />
}
