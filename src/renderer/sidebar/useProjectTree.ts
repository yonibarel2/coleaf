import { useCallback, useEffect, useRef, useState } from 'react'
import type { TreeEntry } from '../../preload/contract'

export interface ProjectTree {
  /** Entries of every folder listed so far, by folder path (`''` is the root). */
  entries: Record<string, TreeEntry[] | undefined>
  expanded: ReadonlySet<string>
  toggle: (path: string) => void
}

/**
 * The lazy folder tree of the open project: folders load when expanded and follow outside
 * changes. The background knows which project is open; mount this once per project (key it on
 * the project root) so a new project starts from an empty tree.
 */
export function useProjectTree(): ProjectTree {
  const [entries, setEntries] = useState<ProjectTree['entries']>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const loaded = useRef(new Set<string>())

  const load = useCallback((path: string) => {
    void window.coleaf.project.listDir(path).then(
      (list) => {
        loaded.current.add(path)
        setEntries((prev) => ({ ...prev, [path]: list }))
      },
      () => setEntries((prev) => ({ ...prev, [path]: [] })) // gone or unreadable
    )
  }, [])

  useEffect(() => load(''), [load])

  // Folders changed outside CoLeaf are re-listed, but only ones already shown.
  useEffect(
    () =>
      window.coleaf.project.onDirChanged((path) => {
        if (loaded.current.has(path)) load(path)
      }),
    [load]
  )

  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      })
      if (!loaded.current.has(path)) load(path)
    },
    [load]
  )

  return { entries, expanded, toggle }
}
