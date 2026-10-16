import { useState, type JSX } from 'react'
import { Explorer } from '../sidebar/Explorer'
import { IconBar } from './IconBar'
import { ProjectView } from './ProjectView'
import { useProject } from './useProject'
import './frame.css'

export function App(): JSX.Element {
  const project = useProject()
  const [explorerOpen, setExplorerOpen] = useState(true)

  return (
    <div className={`frame${explorerOpen ? '' : ' frame--no-sidebar'}`}>
      <IconBar
        explorerOpen={explorerOpen}
        onToggleExplorer={() => setExplorerOpen((open) => !open)}
      />
      {project ? (
        <ProjectView key={project.root} project={project} explorerOpen={explorerOpen} />
      ) : (
        <>
          {explorerOpen && <Explorer project={null} activePath={null} onOpenFile={() => {}} />}
          <main className="workspace" />
        </>
      )}
    </div>
  )
}
