import { useState, type JSX } from 'react'

export interface LinkDraft {
  text: string
  href: string
}

interface LinkPanelProps {
  draft: LinkDraft
  onInsert: (link: LinkDraft) => void
  onCancel: () => void
}

/** The link panel (Ctrl+K): text to show and address. See docs/ui/ribbon-panels.png. */
export function LinkPanel({ draft, onInsert, onCancel }: LinkPanelProps): JSX.Element {
  const [text, setText] = useState(draft.text)
  const [href, setHref] = useState(draft.href)
  const canInsert = href.trim() !== ''

  return (
    <form
      className="link-panel"
      onSubmit={(event) => {
        event.preventDefault()
        if (canInsert) onInsert({ text: text.trim() || href.trim(), href: href.trim() })
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <label className="link-panel__field">
        <span>Text to show</span>
        <input value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <label className="link-panel__field">
        <span>Address</span>
        <input
          value={href}
          onChange={(event) => setHref(event.target.value)}
          autoFocus
          placeholder="https://… or docs/plan.md or #heading"
        />
      </label>
      <p className="link-panel__hint">A web address, a file path, or #heading in this file</p>
      <div className="link-panel__actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={!canInsert}>
          Insert
        </button>
      </div>
    </form>
  )
}
