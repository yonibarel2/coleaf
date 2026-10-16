import type { GitIdentity, GitStatus } from '../../preload/contract'
import { commit, identity, setIdentity, status } from './repo'

// The project watcher reports a burst of changes folder by folder; one status run covers it.
const debounceMs = 200

/**
 * The Git status of the open project, refreshed after every change on disk and reported when it
 * differs from the last one. One status runs at a time; a change during a run queues one more.
 */
export class GitTracker {
  private root: string | null = null
  private last: GitStatus | null = null
  private timer: NodeJS.Timeout | undefined
  private running: Promise<GitStatus> | null = null
  private again = false

  constructor(private readonly onStatus: (status: GitStatus) => void) {}

  open(root: string): void {
    this.close()
    this.root = root
    this.touch()
  }

  close(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    this.root = null
    this.last = null
    this.again = false
  }

  /** Something changed on disk: look again soon. */
  touch(): void {
    if (!this.root) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.refresh().catch(() => {}) // Git itself failed; the next change tries again
    }, debounceMs)
  }

  /** A fresh status, run now. */
  refresh(): Promise<GitStatus> {
    if (this.running) {
      this.again = true
      return this.running
    }
    const root = this.root
    if (!root) return Promise.reject(new Error('No project is open'))
    const run = status(root).then((result) => {
      if (this.root !== root) return result
      if (JSON.stringify(result) !== JSON.stringify(this.last)) {
        this.last = result
        this.onStatus(result)
      }
      return result
    })
    this.running = run.finally(() => {
      this.running = null
      if (this.again) {
        this.again = false
        this.touch()
      }
    })
    return this.running
  }

  async commit(paths: string[], message: string): Promise<void> {
    try {
      await commit(this.openRoot(), paths, message)
    } finally {
      this.touch()
    }
  }

  identity(): Promise<GitIdentity> {
    return identity(this.openRoot())
  }

  setIdentity(value: GitIdentity): Promise<void> {
    return setIdentity(this.openRoot(), value)
  }

  private openRoot(): string {
    if (!this.root) throw new Error('No project is open')
    return this.root
  }
}
