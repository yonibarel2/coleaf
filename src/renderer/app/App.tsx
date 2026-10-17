import { useEffect, useState, type JSX } from 'react'
import { Explorer } from '../sidebar/Explorer'
import { IconBar, type SidebarView } from './IconBar'
import { ProjectView } from './ProjectView'
import { ShortcutsDialog } from './ShortcutsDialog'
import { useAccount } from './useAccount'
import { useGitStatus } from './useGit'
import { useProject } from './useProject'
import './frame.css'

export function App(): JSX.Element {
  const project = useProject()
  const status = useGitStatus(project)
  const account = useAccount()
  const [view, setView] = useState<SidebarView | null>('explorer')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Help › Keyboard Shortcuts, with or without a project open.
  useEffect(() => window.coleaf.app.onShowShortcuts(() => setShortcutsOpen(true)), [])

  // The Sync view needs a project; without one the sidebar shows the Explorer instead.
  const shown = project || view === null ? view : 'explorer'

  return (
    <>
      <div className={`frame${shown ? '' : ' frame--no-sidebar'}`}>
        <IconBar
          view={shown}
          hasProject={project !== null}
          changeCount={status?.changes.length ?? 0}
          account={account}
          onSelect={(next) => setView((current) => (current === next ? null : next))}
        />
        {project ? (
          <ProjectView key={project.root} project={project} view={shown} status={status} />
        ) : (
          <>
            {shown && (
              <Explorer project={null} branch={null} activePath={null} onOpenFile={() => {}} />
            )}
            <main className="workspace" />
          </>
        )}
      </div>
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </>
  )
}
