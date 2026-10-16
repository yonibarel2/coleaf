import { Editor } from '@tiptap/core'
import type { Node as PmNode } from 'prosemirror-model'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentFormat } from '../../preload/contract'
import { createExtensions, schema } from '../editor/extensions'
import { markdownToDoc } from '../markdown/toDoc'
import { docToMarkdown } from '../markdown/toMarkdown'
import { needsSave } from './saveRule'

export interface Tab {
  /** Tree path of the file. */
  path: string
  name: string
  editor: Editor
  /** The document as last read from or written to disk. */
  savedDoc: PmNode
  dirty: boolean
  /** How the file is stored; saving keeps it. */
  format: DocumentFormat
  /** Not valid UTF-8: shown, never written. */
  readOnly: boolean
}

export interface Tabs {
  tabs: Tab[]
  active: Tab | null
  /** Opens the file in a tab (or shows its tab) and returns it; null while it is still opening. */
  open: (path: string) => Promise<Tab | null>
  activate: (path: string) => void
  close: (path: string) => Promise<void>
  saveActive: () => Promise<void>
}

export interface TabsOptions {
  /** Ctrl+K in the editor of the document at `path`. */
  onLink: (path: string, editor: Editor) => void
  /** Ctrl+F in the editor of the document at `path`. */
  onFind: (path: string) => void
  /** Ctrl+click on a link in the document at `fromPath`. */
  onActivateLink: (fromPath: string, href: string) => void
}

/**
 * The open documents, one editor each. Mount once per project (key the owner on the project
 * root): the background settles unsaved changes before the project changes, so a new project
 * starts with no tabs.
 */
export function useTabs(options: TabsOptions): Tabs {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const tabsRef = useRef<Tab[]>([])
  const opening = useRef(new Set<string>())
  const callbacks = useRef(options)

  useEffect(() => {
    tabsRef.current = tabs
    callbacks.current = options
  })

  // Editors are not React state: free them when the owner goes away.
  useEffect(() => () => tabsRef.current.forEach((tab) => tab.editor.destroy()), [])

  const patch = useCallback((path: string, changes: Partial<Tab>) => {
    setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, ...changes } : tab)))
  }, [])

  const open = useCallback(
    async (path: string): Promise<Tab | null> => {
      const shown = tabsRef.current.find((tab) => tab.path === path)
      if (shown) {
        setActivePath(path)
        return shown
      }
      if (opening.current.has(path)) return null
      opening.current.add(path)
      try {
        const { text, readOnly, ...format } = await window.coleaf.file.read(path)
        const editor = new Editor({
          // A detached element: EditorContent adopts the view when the tab is shown and hands it
          // back when another tab is shown, so the editor (and its undo history) lives on.
          element: document.createElement('div'),
          extensions: createExtensions({
            onLink: () => callbacks.current.onLink(path, editor),
            onFind: () => callbacks.current.onFind(path),
            onActivateLink: (href) => callbacks.current.onActivateLink(path, href),
            documentPath: path
          }),
          content: markdownToDoc(text, schema).toJSON(),
          editable: !readOnly,
          // No typed Markdown shortcuts: formatting only via shortcuts (and the ribbon, later).
          enableInputRules: false,
          enablePasteRules: false,
          editorProps: { attributes: { class: 'document' } }
        })
        const tab: Tab = {
          path,
          name: path.slice(path.lastIndexOf('/') + 1),
          editor,
          savedDoc: editor.state.doc,
          dirty: false,
          format,
          readOnly
        }
        editor.on('update', () => {
          const current = tabsRef.current.find((t) => t.path === path)
          if (!current) return
          const dirty = needsSave(current.savedDoc, editor.state.doc)
          if (dirty !== current.dirty) patch(path, { dirty })
        })
        setTabs((prev) => [...prev, tab])
        setActivePath(path)
        return tab
      } finally {
        opening.current.delete(path)
      }
    },
    [patch]
  )

  const save = useCallback(
    async (tab: Tab) => {
      const doc = tab.editor.state.doc
      if (tab.readOnly || !needsSave(tab.savedDoc, doc)) return // untouched: never rewritten
      await window.coleaf.file.write(tab.path, docToMarkdown(doc), tab.format)
      patch(tab.path, { savedDoc: doc, dirty: needsSave(doc, tab.editor.state.doc) })
    },
    [patch]
  )

  const close = useCallback(
    async (path: string) => {
      const tab = tabsRef.current.find((t) => t.path === path)
      if (!tab) return
      if (tab.dirty) {
        const choice = await window.coleaf.dialog.askSave(tab.name)
        if (choice === 'cancel') return
        if (choice === 'save') await save(tab)
      }
      tab.editor.destroy()
      const remaining = tabsRef.current.filter((t) => t.path !== path)
      const index = tabsRef.current.indexOf(tab)
      setTabs(remaining)
      setActivePath((current) =>
        current === path ? ((remaining[index - 1] ?? remaining[0])?.path ?? null) : current
      )
    },
    [save]
  )

  const saveActive = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.path === activePath)
    if (tab) await save(tab)
  }, [activePath, save])

  // The background asks before the window closes or the project changes.
  useEffect(
    () =>
      window.coleaf.app.onSettleUnsaved(async () => {
        for (const tab of tabsRef.current.filter((t) => t.dirty)) {
          const choice = await window.coleaf.dialog.askSave(tab.name)
          if (choice === 'cancel') {
            window.coleaf.app.unsavedSettled(false)
            return
          }
          if (choice === 'save') await save(tab)
          else patch(tab.path, { savedDoc: tab.editor.state.doc, dirty: false })
        }
        window.coleaf.app.unsavedSettled(true)
      }),
    [patch, save]
  )

  useEffect(() => {
    window.coleaf.app.setUnsaved(tabs.filter((tab) => tab.dirty).length)
  }, [tabs])

  return {
    tabs,
    active: tabs.find((tab) => tab.path === activePath) ?? null,
    open,
    activate: setActivePath,
    close,
    saveActive
  }
}
