import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useState, type JSX } from 'react'
import { renderMath } from './math'

/**
 * An inline formula: drawn with KaTeX; a click selects it and shows its TeX in a field to
 * edit, and the drawing is back once the cursor leaves.
 */
export function MathInlineView(props: ReactNodeViewProps): JSX.Element {
  const { node, editor, selected, updateAttributes } = props
  const code = String(node.attrs['code'])
  return (
    <NodeViewWrapper as="span" className="math-inline" data-selected={selected || undefined}>
      {selected && editor.isEditable ? (
        <input
          className="math-inline__code"
          value={code}
          autoFocus
          aria-label="Math"
          onChange={(event) => updateAttributes({ code: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault()
              editor.commands.focus()
            }
          }}
        />
      ) : (
        <MathPreview code={code} display={false} />
      )}
    </NodeViewWrapper>
  )
}

/** A formula drawn with KaTeX, inline or as a block. */
export function MathPreview({ code, display }: { code: string; display: boolean }): JSX.Element {
  const [drawn, setDrawn] = useState<{ code: string; html: string } | null>(null)
  const html = drawn?.code === code ? drawn.html : null

  useEffect(() => {
    let current = true
    void renderMath(code, display).then((result) => {
      if (current) setDrawn({ code, html: result })
    })
    return () => {
      current = false
    }
  }, [code, display])

  // KaTeX's HTML is built from the formula's text, never raw markup from the file.
  if (html === null) return <span className="math-pending">{code}</span>
  return <span contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} />
}
