import type {
  ConflictChoice,
  ConflictPart,
  GitIdentity,
  GitStatus,
  SyncOutcome
} from '../../preload/contract'
import { readConflict, resolveConflict, resolveFile } from './conflicts'
import { cancelSync, finishSync, sync } from './remote'
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

  commit(paths: string[], message: string): Promise<void> {
    return this.change((root) => commit(root, paths, message))
  }

  sync(paths: string[], message: string, token: string | null): Promise<SyncOutcome> {
    return this.change((root) => sync(root, { paths, message, token }))
  }

  finishSync(token: string | null): Promise<SyncOutcome> {
    return this.change((root) => finishSync(root, token))
  }

  cancelSync(): Promise<void> {
    return this.change((root) => cancelSync(root))
  }

  readConflict(path: string): Promise<ConflictPart[]> {
    return readConflict(this.openRoot(), path)
  }

  resolveConflict(path: string, choices: ConflictChoice[]): Promise<void> {
    return this.change((root) => resolveConflict(root, path, choices))
  }

  resolveFile(path: string, side: 'mine' | 'theirs'): Promise<void> {
    return this.change((root) => resolveFile(root, path, side))
  }

  identity(): Promise<GitIdentity> {
    return identity(this.openRoot())
  }

  setIdentity(value: GitIdentity): Promise<void> {
    return setIdentity(this.openRoot(), value)
  }

  // Something that changes the repository: the status is looked at again afterwards, either way.
  private async change<T>(action: (root: string) => Promise<T>): Promise<T> {
    try {
      return await action(this.openRoot())
    } finally {
      this.touch()
    }
  }

  private openRoot(): string {
    if (!this.root) throw new Error('No project is open')
    return this.root
  }
}
