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

    await writeFile(join(root, 'one.md'), '1')
    await writeFile(join(root, 'two.md'), '2')
    await vi.waitFor(() => expect(changes.filter((c) => c.dir === '')).toHaveLength(1), {
      timeout: 3000
    })
    expect(changes.find((c) => c.dir === '')?.paths.sort()).toEqual(['one.md', 'two.md'])

    watcher.close()
    await writeFile(join(root, 'three.md'), '3')
    await settle(400)
    expect(changes.filter((c) => c.dir === '')).toHaveLength(1)
  })
})
