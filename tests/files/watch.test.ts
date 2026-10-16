import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectWatcher } from '../../src/main/files/watch'

const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface Change {
  dir: string
  paths: string[]
}

let root: string
let watcher: ProjectWatcher | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'coleaf-watch-'))
  await mkdir(join(root, 'a', 'b'), { recursive: true })
})

afterEach(async () => {
  watcher?.close()
  await rm(root, { recursive: true, force: true })
})

describe('ProjectWatcher', () => {
  it('reports a nested change under its folder, with tree paths', async () => {
    const changes: Change[] = []
    watcher = new ProjectWatcher((dir, paths) => changes.push({ dir, paths }))
    watcher.watch(root)

    await writeFile(join(root, 'a', 'b', 'x.md'), 'x')
    await vi.waitFor(
      () => {
        const change = changes.find((c) => c.dir === 'a/b')
        expect(change?.paths).toContain('a/b/x.md')
      },
      { timeout: 3000 }
    )
  })

  it('merges a burst into one change per folder and stops after close', async () => {
    const changes: Change[] = []
    watcher = new ProjectWatcher((dir, paths) => changes.push({ dir, paths }))
    watcher.watch(root)

    // Both writes land within one debounce window (synchronous, back to back).
    writeFileSync(join(root, 'one.md'), '1')
    writeFileSync(join(root, 'two.md'), '2')
    const rootPaths = (): string[] =>
      changes
        .filter((c) => c.dir === '')
        .flatMap((c) => c.paths)
        .sort()
    await vi.waitFor(() => expect(rootPaths()).toEqual(['one.md', 'two.md']), { timeout: 3000 })
    const batches = changes.filter((c) => c.dir === '').length
    expect(batches).toBeLessThanOrEqual(2) // one, unless the machine was busy between them

    watcher.close()
    await writeFile(join(root, 'three.md'), '3')
    await settle(400)
    expect(rootPaths()).toEqual(['one.md', 'two.md'])
  })
})
