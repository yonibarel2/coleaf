import { useEffect, useState, type JSX } from 'react'
import type { ProjectInfo } from '../../preload/contract'
import { Editor } from '../editor/Editor'
import { jumpToHeading, linkDraftFor, resolveLink } from '../editor/link'
import type { LinkDraft } from '../editor/LinkPanel'
import { insertPictures } from '../editor/pictures'
import { Ribbon } from '../ribbon/Ribbon'
import { Explorer } from '../sidebar/Explorer'
import { TabBar } from '../tabs/TabBar'
import { useTabs } from '../tabs/useTabs'
import { readFlag, writeFlag } from './settings'

interface ProjectViewProps {
  project: ProjectInfo
  explorerOpen: boolean
}

/** Everything that belongs to one open project: the Explorer and the tabs. Keyed on the root. */
export function ProjectView({ project, explorerOpen }: ProjectViewProps): JSX.Element {
  // The panels belong to the document they were opened on: shown only while it is the active tab.
  const [linkDraft, setLinkDraft] = useState<{ path: string; draft: LinkDraft } | null>(null)
  const [find, setFind] = useState<{ path: string; replace: boolean } | null>(null)
  const [ribbonHidden, setRibbonHidden] = useState(() => readFlag('ribbonHidden'))
  const tabs = useTabs({
    onLink: (path, editor) => setLinkDraft({ path, draft: linkDraftFor(editor) }),
    onFind: (path) => setFind({ path, replace: false }),
    onActivateLink: (fromPath, href) => void followLink(fromPath, href)
  })
  const { open, saveActive } = tabs
  const active = tabs.active

  // Ctrl+click on a link: a web address opens in the browser (through the background's
  // window-open handler), a Markdown file of the project in a tab, at its heading if named.
  async function followLink(fromPath: string, href: string): Promise<void> {
    const target = resolveLink(fromPath, href)
    if (!target) return
    if (target.kind === 'web') {
      window.open(target.url)
      return
    }
    const tab = await open(target.path).catch(() => null)
    if (tab && target.fragment) jumpToHeading(tab.editor, target.fragment)
  }

  // File › Save (Ctrl+S) and File › New File arrive from the menu, wherever the focus is.
  useEffect(() => window.coleaf.app.onSave(() => void saveActive()), [saveActive])
  useEffect(() => window.coleaf.app.onOpenFile((path) => void open(path)), [open])

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
        {active && (
          <Ribbon
            key={`ribbon:${active.path}`}
            editor={active.editor}
            collapsed={ribbonHidden}
            onToggleCollapsed={() => {
              writeFlag('ribbonHidden', !ribbonHidden)
              setRibbonHidden(!ribbonHidden)
            }}
            onLink={() => setLinkDraft({ path: active.path, draft: linkDraftFor(active.editor) })}
            onFind={(replace) => setFind({ path: active.path, replace })}
            onPicture={() => {
              void window.coleaf.images
                .pick(active.path)
                .then((paths) => insertPictures(active.editor.view, active.path, paths, null))
            }}
          />
        )}
        {active && (
          <Editor
            key={active.path}
            tab={active}
            linkDraft={linkDraft?.path === active.path ? linkDraft.draft : null}
            onLinkDone={() => setLinkDraft(null)}
            find={find?.path === active.path ? find : null}
            onFindDone={() => setFind(null)}
          />
        )}
      </main>
    </>
  )
}
