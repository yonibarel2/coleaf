import { useEffect, useState, type JSX } from 'react'
import type { ProjectInfo } from '../../preload/contract'
import { Editor } from '../editor/Editor'
import { linkDraftFor } from '../editor/link'
import type { LinkDraft } from '../editor/LinkPanel'
import { Explorer } from '../sidebar/Explorer'
import { TabBar } from '../tabs/TabBar'
import { useTabs } from '../tabs/useTabs'

interface ProjectViewProps {
  project: ProjectInfo
  explorerOpen: boolean
}

/** Everything that belongs to one open project: the Explorer and the tabs. Keyed on the root. */
export function ProjectView({ project, explorerOpen }: ProjectViewProps): JSX.Element {
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)
  const tabs = useTabs({
    onLink: () => {
      if (tabs.active) setLinkDraft(linkDraftFor(tabs.active.editor))
    }
  })
  const { saveActive } = tabs

  // Ctrl+S saves the active document, wherever the focus is.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActive()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveActive])

  return (
    <>
      {explorerOpen && (
        <Explorer
          project={project}
          activePath={tabs.active?.path ?? null}
          onOpenFile={(path) => void tabs.open(path)}
        />
      )}
      <main className="workspace">
        <TabBar
          tabs={tabs.tabs}
          active={tabs.active}
          onActivate={tabs.activate}
          onClose={(path) => void tabs.close(path)}
        />
        {tabs.active && (
          <Editor
            key={tabs.active.path}
            tab={tabs.active}
            linkDraft={linkDraft}
            onLinkDone={() => setLinkDraft(null)}
          />
        )}
      </main>
    </>
  )
}
