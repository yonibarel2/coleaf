import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectIgnore } from './ignore'
import { isHiddenName, isMarkdownName } from './project'

/**
 * Which folders of the project hold Markdown, at any depth. Built in the background after a
 * project opens (shallow folders first) and kept current by the watcher.
 */
export class MarkdownIndex {
  // Tree paths of folders that directly contain a Markdown file ('' = the root).
  private readonly direct = new Set<string>()
  // Bumped by reset() and cancel(); a running walk stops when it no longer matches.
  private generation = 0
  complete = false

  constructor(
    private readonly root: string,
    readonly ignore: ProjectIgnore
  ) {}

  /**
   * A folder's status: `true` when Markdown exists under it, `false` when it is skipped or the
   * finished scan found none, `undefined` while the scan is still running.
   */
  status(dir: string): boolean | undefined {
    if (this.ignore.isSkipped(dir)) return false
    if (this.has(dir)) return true
    return this.complete ? false : undefined
  }

  /** Walks the whole project breadth-first. A later scan, or cancel(), stops it. */
  async scan(): Promise<void> {
    const generation = ++this.generation
    this.direct.clear()
    this.complete = false
    this.ignore.clear()
    await this.ignore.load('')
    await this.walk('', generation)
    if (generation === this.generation) this.complete = true
  }

  /** Walks one subtree that appeared after the scan, keeping the rest of the index. */
  scanSubtree(dir: string): Promise<void> {
    return this.walk(dir, this.generation)
  }

  /** Re-reads one folder's direct Markdown flag (and its `.gitignore`, if it has one). */
  async refresh(dir: string): Promise<string[]> {
    let dirents
    try {
      dirents = await readdir(join(this.root, dir), { withFileTypes: true })
    } catch {
      this.prune(dir)
      return []
    }
    const hasRules = dirents.some((d) => d.isFile() && d.name === '.gitignore')
    if (hasRules || this.ignore.hasRules(dir)) await this.ignore.load(dir)
    if (dirents.some((d) => d.isFile() && isMarkdownName(d.name))) this.direct.add(dir)
    else this.direct.delete(dir)
    const subfolders: string[] = []
    for (const dirent of dirents) {
      if (!dirent.isDirectory() || isHiddenName(dirent.name)) continue
      const child = dir ? `${dir}/${dirent.name}` : dirent.name
      if (!this.ignore.isSkipped(child)) subfolders.push(child)
    }
    return subfolders
  }

  /** Forgets a removed folder and everything under it. */
  prune(dir: string): void {
    const prefix = `${dir}/`
    for (const key of [...this.direct]) {
      if (key === dir || key.startsWith(prefix)) this.direct.delete(key)
    }
  }

  cancel(): void {
    this.generation++
  }

  private has(dir: string): boolean {
    if (this.direct.has(dir)) return true
    const prefix = dir === '' ? '' : `${dir}/`
    for (const key of this.direct) if (key.startsWith(prefix)) return true
    return false
  }

  private async walk(from: string, generation: number): Promise<void> {
    const queue = [from]
    while (queue.length > 0 && generation === this.generation) {
      const dir = queue.shift() as string
      queue.push(...(await this.refresh(dir)))
    }
  }
}
