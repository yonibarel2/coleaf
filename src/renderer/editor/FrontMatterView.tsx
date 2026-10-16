import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useState, type JSX } from 'react'
import { CodeEditor, EditCodeButton } from './EditCode'
import { frontMatterTable, type FrontMatterTable } from './frontMatter'

/** YAML front matter as a table of keys and values; Edit code shows the YAML itself. */
export function FrontMatterView(props: ReactNodeViewProps): JSX.Element {
  const { node, editor, updateAttributes } = props
  const source = String(node.attrs['source'])
  const [editing, setEditing] = useState(false)
  const [parsed, setParsed] = useState<{ source: string; table: FrontMatterTable } | null>(null)
  const table = parsed?.source === source ? parsed.table : null

  useEffect(() => {
    let current = true
    void frontMatterTable(source).then((result) => {
      if (current) setParsed({ source, table: result })
    })
    return () => {
      current = false
    }
  }, [source])

  const done = (): void => {
    setEditing(false)
    editor.commands.focus()
  }

  return (
    <NodeViewWrapper className="front-matter" data-editing={editing || undefined}>
      {editing ? (
        <CodeEditor
          value={source}
          label="Front matter"
          onChange={(value) => updateAttributes({ source: value })}
          onDone={done}
        />
      ) : (
        <>
          {editor.isEditable && <EditCodeButton onClick={() => setEditing(true)} />}
          <div className="front-matter__title" contentEditable={false}>
            Front matter
          </div>
          {table === null && <pre className="front-matter__code">{source}</pre>}
          {table !== null && 'error' in table && (
            <div contentEditable={false}>
              <pre className="front-matter__code">{source}</pre>
              <p className="front-matter__error">Not valid YAML: {table.error}</p>
            </div>
          )}
          {table !== null && 'rows' in table && (
            <table className="front-matter__table" contentEditable={false}>
              <tbody>
                {table.rows.map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </NodeViewWrapper>
  )
}
