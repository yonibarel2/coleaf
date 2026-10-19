import { useState, type JSX } from 'react'
import type { ProjectInfo } from '../../preload/contract'
import { readFlag, writeFlag } from '../app/settings'
import { ProjectSection } from './ProjectSection'
import './sidebar.css'

interface ExplorerProps {
  project: ProjectInfo | null
  /** The file shown in the active tab, highlighted in the tree. */
  activePath: string | null
  onOpenFile: (path: string) => void
}

/** The Explorer sidebar: the Project tree, later also History. */
export function Explorer({ project, activePath, onOpenFile }: ExplorerProps): JSX.Element {
  // "Only .md" is one decision for every folder of every project: by the header, and kept.
  const [onlyMarkdown, setOnlyMarkdown] = useState(() => readFlag('onlyMarkdown'))

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        Explorer
        {project && (
          <label className="sidebar__option">
            <input
              type="checkbox"
              checked={onlyMarkdown}
              onChange={(event) => {
                writeFlag('onlyMarkdown', event.target.checked)
                setOnlyMarkdown(event.target.checked)
              }}
            />
            Only .md
          </label>
        )}
      </div>
      <div className="sidebar__body">
        {project ? (
          <ProjectSection
            key={project.root}
            project={project}
            onlyMarkdown={onlyMarkdown}
            activePath={activePath}
            onOpenFile={onOpenFile}
          />
        ) : (
          <NoProject />
        )}
      </div>
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
