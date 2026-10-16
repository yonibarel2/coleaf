import type { JSX } from 'react'
import type { ProjectInfo } from '../../preload/contract'
import { ProjectSection } from './ProjectSection'
import './sidebar.css'

interface ExplorerProps {
  project: ProjectInfo | null
  /** The Git branch, shown in grey next to the title; null without a repository. */
  branch: string | null
  /** The file shown in the active tab, highlighted in the tree. */
  activePath: string | null
  onOpenFile: (path: string) => void
}

/** The Explorer sidebar: the Project tree, later also History. */
export function Explorer({ project, branch, activePath, onOpenFile }: ExplorerProps): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        Explorer
        {branch && <span className="sidebar__branch">{branch}</span>}
      </div>
      {project ? (
        <ProjectSection key={project.root} activePath={activePath} onOpenFile={onOpenFile} />
      ) : (
        <NoProject />
      )}
    </aside>
  )
}

function NoProject(): JSX.Element {
  return (
    <div className="sidebar__empty">
      <p>No project open.</p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => void window.coleaf.project.open()}
      >
        Open project
      </button>
    </div>
  )
}
