import { useEffect, useMemo, useState, type JSX } from 'react'
import type { ConflictPart, GitStatus, ProjectInfo } from '../../preload/contract'
import { ConflictTab } from '../conflict/ConflictTab'
import { Editor } from '../editor/Editor'
import { jumpToHeading, linkDraftFor, resolveLink } from '../editor/link'
import type { LinkDraft } from '../editor/LinkPanel'
import { insertPictures } from '../editor/pictures'
import { Ribbon } from '../ribbon/Ribbon'
import { Explorer } from '../sidebar/Explorer'
import { SyncView } from '../sidebar/SyncView'
import { TabBar, type TabItem } from '../tabs/TabBar'
import { useTabs } from '../tabs/useTabs'
import type { SidebarView } from './IconBar'
import { readFlag, writeFlag } from './settings'
import { messageOf } from './useGit'

interface ProjectViewProps {
  project: ProjectInfo
  view: SidebarView | null
  status: GitStatus | null
}

/** A conflicted file open as Mine / Theirs pages; its tab sits after the documents. */
interface Conflict {
  path: string
  parts: ConflictPart[]
}

const conflictKey = (path: string): string => `conflict:${path}`

/** Everything that belongs to one open project: the sidebar and the tabs. Keyed on the root. */
export function ProjectView({ project, view, status }: ProjectViewProps): JSX.Element {
  // The panels belong to the document they were opened on: shown only while it is the active tab.
  const [linkDraft, setLinkDraft] = useState<{ path: string; draft: LinkDraft } | null>(null)
  const [find, setFind] = useState<{ path: string; replace: boolean } | null>(null)
  const [ribbonHidden, setRibbonHidden] = useState(() => readFlag('ribbonHidden'))
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [conflictShown, setConflictShown] = useState(false)
  const tabs = useTabs({
    onLink: (path, editor) => setLinkDraft({ path, draft: linkDraftFor(editor) }),
    onFind: (path) => setFind({ path, replace: false }),
    onActivateLink: (fromPath, href) => void followLink(fromPath, href)
  })
  const { open, saveActive, reloadClean } = tabs
  const active = conflictShown ? null : tabs.active
  const unsavedPaths = useMemo(
    () => tabs.tabs.filter((tab) => tab.dirty).map((tab) => tab.path),
    [tabs.tabs]
  )

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

  async function openConflict(path: string): Promise<void> {
    try {
      const parts = await window.coleaf.git.readConflict(path)
      setConflict({ path, parts })
      setConflictShown(true)
    } catch (error) {
      window.alert(messageOf(error))
    }
  }

  // The tab bar: the documents, then the conflict pages when a file is being settled.
  const items: TabItem[] = tabs.tabs.map((tab) => ({
    key: tab.path,
    name: tab.name,
    title: tab.path,
    dirty: tab.dirty
  }))
  if (conflict) {
    const name = conflict.path.slice(conflict.path.lastIndexOf('/') + 1)
    items.push({
      key: conflictKey(conflict.path),
      name: `${name} · conflict`,
      title: conflict.path,
      dirty: false,
      conflict: true
    })
  }
  const activeKey = conflictShown && conflict ? conflictKey(conflict.path) : (active?.path ?? null)

  function activate(key: string): void {
    if (conflict && key === conflictKey(conflict.path)) setConflictShown(true)
    else {
      setConflictShown(false)
      tabs.activate(key)
    }
  }

  function close(key: string): void {
    if (conflict && key === conflictKey(conflict.path)) {
      setConflict(null)
      setConflictShown(false)
    } else void tabs.close(key)
  }

  // File › Save (Ctrl+S) and File › New File arrive from the menu, wherever the focus is.
  useEffect(() => window.coleaf.app.onSave(() => void saveActive()), [saveActive])
  useEffect(() => window.coleaf.app.onOpenFile((path) => void open(path)), [open])

  return (
    <>
      {view === 'explorer' && (
        <Explorer
          project={project}
          activePath={active?.path ?? null}
          onOpenFile={(path) => {
            setConflictShown(false)
            void tabs.open(path)
          }}
        />
      )}
      {view === 'sync' && (
        <SyncView
          status={status}
          unsavedPaths={unsavedPaths}
          onBeforeSync={tabs.saveAll}
          onSynced={(outcome) => {
            if (outcome.pulled) void reloadClean()
            if (outcome.kind !== 'conflicts') {
              setConflict(null)
              setConflictShown(false)
            }
          }}
          onOpenConflict={(path) => void openConflict(path)}
        />
      )}
      <main className="workspace">
        <TabBar items={items} activeKey={activeKey} onActivate={activate} onClose={close} />
        {conflictShown && conflict && (
          <ConflictTab
            key={conflict.path}
            path={conflict.path}
            parts={conflict.parts}
            onDone={(choices) => {
              void window.coleaf.git
                .resolveConflict(conflict.path, choices)
                .then(() => {
                  setConflict(null)
                  setConflictShown(false)
                  return reloadClean()
                })
                .catch((error) => window.alert(messageOf(error)))
            }}
          />
        )}
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
