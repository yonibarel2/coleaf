import { useEffect, useState, type JSX } from 'react'
import { Explorer } from '../sidebar/Explorer'
import { IconBar } from './IconBar'
import { ProjectView } from './ProjectView'
import { ShortcutsDialog } from './ShortcutsDialog'
import { useProject } from './useProject'
import './frame.css'

export function App(): JSX.Element {
  const project = useProject()
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Help › Keyboard Shortcuts, with or without a project open.
  useEffect(() => window.coleaf.app.onShowShortcuts(() => setShortcutsOpen(true)), [])

  return (
    <>
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
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </>
  )
}
