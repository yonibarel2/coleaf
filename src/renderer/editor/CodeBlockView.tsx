import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import type { JSX } from 'react'
import { languages } from './languages'

/** A code block with its language picker in the corner (docs/ui/ribbon-panels.png). */
export function CodeBlockView({ node, editor, updateAttributes }: ReactNodeViewProps): JSX.Element {
  const language = typeof node.attrs['language'] === 'string' ? node.attrs['language'] : ''
  const listed = languages.some(([id]) => id === language)
  return (
    <NodeViewWrapper className="code-block">
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
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
