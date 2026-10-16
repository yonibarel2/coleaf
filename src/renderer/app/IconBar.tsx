import { Files, Settings, User } from 'lucide-react'
import type { JSX } from 'react'

interface IconBarProps {
  explorerOpen: boolean
  onToggleExplorer: () => void
}

/** The left icon bar: one view at a time at the top, account and settings at the bottom. */
export function IconBar({ explorerOpen, onToggleExplorer }: IconBarProps): JSX.Element {
  return (
    <nav className="icon-bar" aria-label="Views">
      <button
        type="button"
        className={`icon-button${explorerOpen ? ' icon-button--active' : ''}`}
        title="Explorer"
        aria-pressed={explorerOpen}
        onClick={onToggleExplorer}
      >
        <Files />
      </button>
      <div className="icon-bar__spacer" />
      <button type="button" className="icon-button" title="Account (coming soon)" disabled>
        <User />
      </button>
      <button type="button" className="icon-button" title="Settings (coming soon)" disabled>
        <Settings />
      </button>
    </nav>
  )
}
