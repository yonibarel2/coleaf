import { useEffect, useState } from 'react'
import type { GitStatus, ProjectInfo } from '../../preload/contract'

/** The Git status of the open project, mirrored from the background; null while unknown. */
export function useGitStatus(project: ProjectInfo | null): GitStatus | null {
  // Kept with the root it belongs to, so another project starts from null without a reset.
  const [known, setKnown] = useState<{ root: string; status: GitStatus } | null>(null)
  const root = project?.root ?? null

  useEffect(() => {
    if (root === null) return
    let live = true
    let heard = false // a change may arrive before the first lookup answers; the change is newer
    const off = window.coleaf.git.onChanged((status) => {
      heard = true
      if (live) setKnown({ root, status })
    })
    void window.coleaf.git
      .status()
      .then((status) => {
        if (live && !heard) setKnown({ root, status })
      })
      .catch(() => {}) // Git itself failed to run; the view stays empty
    return () => {
      live = false
      off()
    }
  }, [root])

  return known !== null && known.root === root ? known.status : null
}

/** The text of an error thrown across the bridge, without Electron's wrapping. */
export function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']*': /, '').replace(/^Error: /, '')
}
