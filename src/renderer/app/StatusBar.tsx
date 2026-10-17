import { GitBranch } from 'lucide-react'
import type { JSX } from 'react'
import type { GitStatus, ProjectInfo } from '../../preload/contract'

interface StatusBarProps {
  project: ProjectInfo | null
  status: GitStatus | null
}

/** The bar along the bottom of the window, as in VS Code or Word: the branch, for now. */
export function StatusBar({ project, status }: StatusBarProps): JSX.Element {
  return (
    <footer className="status-bar" aria-label="Status">
      {project && status && (
        <span className="status-bar__item" title={status.repo ? 'Git branch' : undefined}>
          <GitBranch />
          {status.repo ? (status.branch ?? 'no branch') : 'Not a Git repository'}
        </span>
      )}
    </footer>
  )
}
