import { watch, type FSWatcher } from 'node:fs'

// Editors write a file in several steps; one change per folder per burst is enough.
const debounceMs = 150

interface Pending {
  timer: NodeJS.Timeout
  paths: Set<string>
}

/**
 * One recursive watcher on the project root. Changes are reported per folder (tree path) with
 * the changed paths under it, after a short debounce. Linux note: Node's recursive watch there
 * uses one inotify watch per folder, so very large projects may hit the system limit.
 */
export class ProjectWatcher {
  private watcher: FSWatcher | undefined
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly onChange: (dir: string, paths: string[]) => void) {}

  watch(root: string): void {
    this.close()
    try {
      this.watcher = watch(root, { recursive: true }, (_type, filename) => {
        if (typeof filename !== 'string' || filename === '') return
        this.schedule(filename.split('\\').join('/'))
      })
    } catch {
      return // the folder vanished; the session will close
    }
    this.watcher.on('error', () => this.close())
  }

  close(): void {
    this.watcher?.close()
    this.watcher = undefined
    for (const { timer } of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
  }

  private schedule(path: string): void {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const pending = this.pending.get(dir)
    const paths = pending?.paths ?? new Set<string>()
    paths.add(path)
    if (pending) clearTimeout(pending.timer)
    const timer = setTimeout(() => {
      this.pending.delete(dir)
      this.onChange(dir, [...paths])
    }, debounceMs)
    this.pending.set(dir, { timer, paths })
  }
}
