import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectoryWatchers } from '../../src/main/files/watch'

const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let dir: string
let watchers: DirectoryWatchers | undefined

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coleaf-watch-'))
})

afterEach(async () => {
  watchers?.closeAll()
  await rm(dir, { recursive: true, force: true })
})

describe('DirectoryWatchers', () => {
  it('reports one change per folder for a burst of writes, and none after closeAll', async () => {
    const changes: string[] = []
    watchers = new DirectoryWatchers((changed) => changes.push(changed))
    watchers.watch(dir)

    await writeFile(join(dir, 'a.md'), 'a')
    await writeFile(join(dir, 'b.md'), 'b')
    await vi.waitFor(() => expect(changes).toEqual([dir]), { timeout: 3000 })

    watchers.closeAll()
    await writeFile(join(dir, 'c.md'), 'c')
    await settle(400)
    expect(changes).toEqual([dir])
  })

  it('watches a folder only once', async () => {
    const changes: string[] = []
    watchers = new DirectoryWatchers((changed) => changes.push(changed))
    watchers.watch(dir)
    watchers.watch(dir)

    await writeFile(join(dir, 'a.md'), 'a')
    await vi.waitFor(() => expect(changes).toEqual([dir]), { timeout: 3000 })
    await settle(400)
    expect(changes).toEqual([dir])
  })
})
