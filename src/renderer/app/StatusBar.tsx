import type { JSX } from 'react'
import type { GitStatus, ProjectInfo } from '../../preload/contract'

interface StatusBarProps {
  project: ProjectInfo | null
  status: GitStatus | null
  /** Words in the active document; null without one. */
  words: number | null
}

/** The bar along the bottom of the window, as in VS Code or Word: the branch and the word count. */
export function StatusBar({ project, status, words }: StatusBarProps): JSX.Element {
  return (
    <footer className="status-bar" aria-label="Status">
      {project && status && (
        <span className="status-bar__item" data-tip={status.repo ? 'Git branch' : undefined}>
          <BranchIcon />
          {status.repo ? (status.branch ?? 'no branch') : 'Not a Git repository'}
        </span>
      )}
      {words !== null && (
        <span className="status-bar__item">
          {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        </span>
      )}
    </footer>
  )
}

// The branch sign as code editors draw it at 16 px: a line with a ring at each end, and a
// rounded branch from a third ring on the right. Drawn with 1 px strokes on a 16-unit grid.
function BranchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <circle cx="4.5" cy="2.5" r="2" />
      <circle cx="4.5" cy="13.5" r="2" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M4.5 4.5v7M11.5 7.5a2 2 0 0 1-2 2h-3a2 2 0 0 0-2 2" />
    </svg>
  )
}
