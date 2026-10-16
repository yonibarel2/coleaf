import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
  type ReactNodeViewProps
} from '@tiptap/react'
import { Code } from 'lucide-react'
import { useEffect, useState, type JSX } from 'react'
import { renderDiagram, type Diagram } from './diagrams'
import { previewKindOf } from './highlight'
import { languages } from './languages'
import { MathPreview } from './MathInlineView'

/**
 * A code block with its language picker in the corner (docs/ui/ribbon-panels.png). A Mermaid
 * or math block shows its diagram or formula while the cursor is elsewhere, and its code, with
 * the picker, while the cursor is inside; "Edit code" on the picture puts the cursor there.
 */
export function CodeBlockView(props: ReactNodeViewProps): JSX.Element {
  const { node, editor, getPos, updateAttributes, selected } = props
  const language = typeof node.attrs['language'] === 'string' ? node.attrs['language'] : ''
  const listed = languages.some(([id]) => id === language)
  const kind = previewKindOf(language)
  const inside = useEditorState({
    editor,
    selector: ({ editor }) => {
      const pos = getPos()
      if (pos === undefined) return false
      const { from, to } = editor.state.selection
      return from >= pos && to <= pos + node.nodeSize
    }
  })
  const showCode = kind === null || inside || selected
  const editCode = (): void => {
    const pos = getPos()
    if (pos !== undefined)
      editor
        .chain()
        .focus(pos + 1)
        .run()
  }

  return (
    <NodeViewWrapper className={`code-block${showCode ? '' : ' code-block--preview'}`}>
      {showCode ? (
        <select
          className="code-block__language"
          contentEditable={false}
          value={language}
          disabled={!editor.isEditable}
          title="Sets the code colors"
          aria-label="Language"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}
        >
          {!listed && <option value={language}>{language}</option>}
          {languages.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          className="code-block__edit"
          contentEditable={false}
          title="Edit code"
          onMouseDown={(event) => event.preventDefault()}
          onClick={editCode}
        >
          <Code />
          <span>Edit code</span>
        </button>
      )}
      {!showCode && kind === 'mermaid' && <DiagramPreview code={node.textContent} />}
      {!showCode && kind === 'math' && (
        <div className="preview preview--math" contentEditable={false}>
          <MathPreview code={node.textContent} display />
        </div>
      )}
      <pre className={showCode ? undefined : 'code-block__hidden'}>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

function DiagramPreview({ code }: { code: string }): JSX.Element {
  const [drawn, setDrawn] = useState<{ code: string; diagram: Diagram } | null>(null)
  const diagram = drawn?.code === code ? drawn.diagram : null

  useEffect(() => {
    let current = true
    void renderDiagram(code).then((result) => {
      if (current) setDrawn({ code, diagram: result })
    })
    return () => {
      current = false
    }
  }, [code])

  if (diagram === null) return <div className="preview preview--pending">Drawing the diagram…</div>
  if ('error' in diagram) {
    return (
      <div className="preview preview--error" contentEditable={false}>
        <pre>{code}</pre>
        <p>Mermaid cannot draw this: {diagram.error}</p>
      </div>
    )
  }
  return (
    <div
      className="preview preview--diagram"
      contentEditable={false}
      dangerouslySetInnerHTML={{ __html: diagram.svg }}
    />
  )
}
