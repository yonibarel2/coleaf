import { useEffect, useState } from 'react'
import type { ProjectInfo } from '../../preload/contract'

/** The project open in the background, kept in sync and reflected in the window title. */
export function useProject(): ProjectInfo | null {
  const [project, setProject] = useState<ProjectInfo | null>(null)

  useEffect(() => {
    void window.coleaf.project.getCurrent().then(setProject)
    return window.coleaf.project.onChanged(setProject)
  }, [])

  useEffect(() => {
    document.title = project ? `${project.name} – CoLeaf` : 'CoLeaf'
  }, [project])

  return project
}
