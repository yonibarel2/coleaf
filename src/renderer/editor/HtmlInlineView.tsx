import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useMemo, type JSX } from 'react'
import { parseTag } from '../markdown/htmlTags'
import { isBlank, sanitizeHtml } from './html'
import type { HtmlInlineOptions } from './nodes'

/**
 * One piece of inline HTML with no text of its own: a line break, a picture, a comment, an
 * anchor target, or a tag without its partner. Shown sanitized where it shows anything, as a
 * chip otherwise; a click selects it and shows its code in a field to edit.
 */
export function HtmlInlineView(props: ReactNodeViewProps<HtmlInlineOptions>): JSX.Element {
  const { node, editor, extension, selected, updateAttributes } = props
  const html = String(node.attrs['html'])
  const { documentPath } = extension.options
  const rendered = useMemo(() => sanitizeHtml(html, documentPath), [html, documentPath])
  const kind = parseTag(html).kind

  if (selected && editor.isEditable) {
    return (
      <NodeViewWrapper as="span" className="html-inline html-inline--editing">
        <input
          className="html-inline__code"
          value={html}
          autoFocus
          aria-label="HTML"
          onChange={(event) => updateAttributes({ html: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault()
              editor.commands.focus()
            }
          }}
        />
      </NodeViewWrapper>
    )
  }
  if (kind === 'comment' || isBlank(rendered)) {
    return (
      <NodeViewWrapper
        as="span"
        className={`html-inline html-inline--chip${kind === 'comment' ? ' html-inline--comment' : ''}`}
        data-tip={html}
      >
        {html}
      </NodeViewWrapper>
    )
  }
  // Sanitized above: DOMPurify's output, never the file's markup as it is.
  return (
    <NodeViewWrapper
      as="span"
      className="html-inline"
      data-tip={html}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}
