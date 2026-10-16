import type { JSX } from 'react'
import type { ProjectInfo } from '../../preload/contract'
import { ProjectSection } from './ProjectSection'
import './sidebar.css'

interface ExplorerProps {
  project: ProjectInfo | null
}

/** The Explorer sidebar: the Project tree, later also History. */
export function Explorer({ project }: ExplorerProps): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">Explorer</div>
      {project ? <ProjectSection key={project.root} /> : <NoProject />}
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
