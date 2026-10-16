import { watch, type FSWatcher } from 'node:fs'

// Editors write a file in several steps; one change per folder per burst is enough.
const debounceMs = 150
// Watchers only exist for folders the user expanded; the cap protects against extreme cases.
const maxWatchers = 500

/** One non-recursive watcher per folder the window has listed. */
export class DirectoryWatchers {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly onChange: (dir: string) => void) {}

  watch(dir: string): void {
    if (this.watchers.has(dir)) return
    if (this.watchers.size >= maxWatchers) {
      const oldest = this.watchers.keys().next().value
      if (oldest !== undefined) this.close(oldest)
    }
    let watcher: FSWatcher
    try {
      watcher = watch(dir, () => this.schedule(dir))
    } catch {
      return // the folder vanished between listing and watching; its parent reports that
    }
    watcher.on('error', () => this.close(dir))
    this.watchers.set(dir, watcher)
  }

  close(dir: string): void {
    this.watchers.get(dir)?.close()
    this.watchers.delete(dir)
    clearTimeout(this.timers.get(dir))
    this.timers.delete(dir)
  }

  closeAll(): void {
    for (const dir of [...this.watchers.keys()]) this.close(dir)
  }

  private schedule(dir: string): void {
    clearTimeout(this.timers.get(dir))
    this.timers.set(
      dir,
      setTimeout(() => {
        this.timers.delete(dir)
        this.onChange(dir)
      }, debounceMs)
    )
  }
}
