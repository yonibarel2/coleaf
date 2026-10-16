import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitStatus } from '../../src/preload/contract'
import { GitTracker } from '../../src/main/git/tracker'
import { commitAll, initRepo, isolateGitConfig, tempDir, write } from './temp-repo'

beforeAll(isolateGitConfig)

let root: string
let reported: GitStatus[]
let tracker: GitTracker

beforeEach(async () => {
  root = await tempDir('proj')
  await initRepo(root)
  await write(root, 'a.md', 'a\n')
  await commitAll(root, 'First')
  reported = []
  tracker = new GitTracker((status) => reported.push(status))
})

afterEach(() => tracker.close())

const paths = (status: GitStatus | undefined): string[] =>
  (status?.changes ?? []).map((change) => change.path)

describe('GitTracker', () => {
  it('reports the status soon after opening, and again only when it changes', async () => {
    tracker.open(root)
    await vi.waitFor(() => expect(reported).toHaveLength(1), { timeout: 5000 })
    expect(reported[0]).toEqual({ repo: true, branch: 'main', changes: [] })

    tracker.touch()
    tracker.touch()
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(reported).toHaveLength(1) // nothing changed: nothing reported

    await write(root, 'b.md', 'b\n')
    tracker.touch()
    await vi.waitFor(() => expect(paths(reported.at(-1))).toEqual(['b.md']), { timeout: 5000 })
    expect(reported).toHaveLength(2)
  })

  it('runs a fresh status on demand and rejects without a project', async () => {
    await expect(tracker.refresh()).rejects.toThrow(/No project/)
    tracker.open(root)
    await write(root, 'a.md', 'edited\n')
    expect(paths(await tracker.refresh())).toEqual(['a.md'])
    tracker.close()
    await expect(tracker.refresh()).rejects.toThrow(/No project/)
  })

  it('commits and then reports the cleared status', async () => {
    tracker.open(root)
    await vi.waitFor(() => expect(reported).toHaveLength(1), { timeout: 5000 })
    await write(root, 'a.md', 'edited\n')
    await rm(join(root, 'a.md')).catch(() => {})
    await write(root, 'c.md', 'c\n')
    await tracker.commit(['a.md', 'c.md'], 'Second')
    await vi.waitFor(() => expect(paths(reported.at(-1))).toEqual([]), { timeout: 5000 })
    await expect(tracker.identity()).resolves.toEqual({
      name: 'Test User',
      email: 'test@example.com'
    })
  })

  it('reports a plain folder as not a repository', async () => {
    const plain = await tempDir('plain')
    tracker.open(plain)
    await vi.waitFor(() => expect(reported).toHaveLength(1), { timeout: 5000 })
    expect(reported[0]).toEqual({ repo: false, branch: null, changes: [] })
  })
})
