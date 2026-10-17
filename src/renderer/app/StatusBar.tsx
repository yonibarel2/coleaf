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

// A branch drawn for small sizes: a line with a node at each end and one branching off to the
// right. Thin strokes stay crisp at 14 px, where a general-purpose icon turns into a blot.
function BranchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <circle cx="4.5" cy="3" r="1.8" />
      <circle cx="4.5" cy="13" r="1.8" />
      <circle cx="11.5" cy="5" r="1.8" />
      <path d="M4.5 4.8v6.4M11.5 6.8c0 2.4-2.2 3.4-4.8 3.8" />
    </svg>
  )
}
