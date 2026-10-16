import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useMemo, useState, type JSX, type MouseEvent } from 'react'
import { CodeEditor, EditCodeButton } from './EditCode'
import { isBlank, sanitizeHtml } from './html'
import type { HtmlBlockOptions } from './nodes'

/**
 * A block of HTML from the file, shown sanitized like on GitHub; Edit code shows the HTML
 * itself in a field. A block that shows nothing (a comment, a closing tag on its own) shows
 * its code, small and muted, so it can still be found and edited.
 */
export function HtmlBlockView(props: ReactNodeViewProps<HtmlBlockOptions>): JSX.Element {
  const { node, editor, extension, updateAttributes } = props
  const { documentPath, onActivateLink } = extension.options
  const html = String(node.attrs['html'])
  const [editing, setEditing] = useState(false)
  const rendered = useMemo(() => sanitizeHtml(html, documentPath), [html, documentPath])

  const done = (): void => {
    setEditing(false)
    editor.commands.focus()
  }

  // Links in the HTML: Ctrl+click follows them, like a Markdown link; a plain click does nothing.
  const click = (event: MouseEvent<HTMLDivElement>): void => {
    const anchor = (event.target as HTMLElement).closest('a[href]')
    if (!anchor) return
    event.preventDefault()
    const href = anchor.getAttribute('href')
    if (href && (event.ctrlKey || event.metaKey)) onActivateLink(href)
  }

  return (
    <NodeViewWrapper className="html-block" data-editing={editing || undefined}>
      {editing ? (
        <CodeEditor
          value={html}
          label="HTML"
          onChange={(value) => updateAttributes({ html: value })}
          onDone={done}
        />
      ) : (
        <>
          {editor.isEditable && <EditCodeButton onClick={() => setEditing(true)} />}
          {isBlank(rendered) ? (
            <pre className="html-block__code" contentEditable={false}>
              {html}
            </pre>
          ) : (
            // Sanitized above: DOMPurify's output, never the file's markup as it is.
            <div
              className="html-block__content"
              contentEditable={false}
              onClick={click}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          )}
        </>
      )}
    </NodeViewWrapper>
  )
}
