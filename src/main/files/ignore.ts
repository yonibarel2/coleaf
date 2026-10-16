import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import ignore, { type Ignore } from 'ignore'

/**
 * Folders that are never scanned for Markdown: `node_modules`, and whatever the project's
 * `.gitignore` files exclude. They show greyed in the tree and can still be expanded.
 */
export class ProjectIgnore {
  // One matcher per folder that holds a .gitignore, keyed by that folder's tree path ('' = root).
  private readonly matchers = new Map<string, Ignore>()

  constructor(private readonly root: string) {}

  /** Loads (or forgets) the `.gitignore` of one folder. */
  async load(dir: string): Promise<void> {
    try {
      const rules = await readFile(join(this.root, dir, '.gitignore'), 'utf8')
      this.matchers.set(dir, ignore().add(rules))
    } catch {
      this.matchers.delete(dir)
    }
  }

  hasRules(dir: string): boolean {
    return this.matchers.has(dir)
  }

  /** Whether a folder (tree path) is skipped: `node_modules`, or excluded by a `.gitignore` above it. */
  isSkipped(dir: string): boolean {
    if (dir === '') return false
    if (dir.split('/').includes('node_modules')) return true
    for (const [base, matcher] of this.matchers) {
      if (base !== '' && !dir.startsWith(`${base}/`)) continue
      const relative = base === '' ? dir : dir.slice(base.length + 1)
      if (matcher.ignores(`${relative}/`)) return true
    }
    return false
  }

  clear(): void {
    this.matchers.clear()
  }
}
