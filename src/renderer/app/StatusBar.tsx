import { GitBranch } from 'lucide-react'
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
          <GitBranch />
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
