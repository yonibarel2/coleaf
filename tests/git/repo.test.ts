import { readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { commit, identity, parseStatus, setIdentity, status } from '../../src/main/git/repo'
import { git } from '../../src/main/git/run'
import {
  commitAll,
  initRepo,
  isolateGitConfig,
  lastCommitFiles,
  log,
  tempDir,
  write
} from './temp-repo'

beforeAll(isolateGitConfig)

describe('status', () => {
  let root: string

  beforeEach(async () => {
    root = await tempDir('proj')
  })

  it('reports a folder outside any repository as not a repo', async () => {
    await expect(status(root)).resolves.toEqual({ repo: false, branch: null, changes: [] })
  })

  it('sees the branch and new files before the first commit', async () => {
    await initRepo(root)
    await write(root, 'README.md', '# Hi\n')
    await expect(status(root)).resolves.toEqual({
      repo: true,
      branch: 'main',
      changes: [{ path: 'README.md', kind: 'new' }]
    })
  })

  it('reports every kind of change with tree paths, sorted by name', async () => {
    await initRepo(root)
    await write(root, 'docs/plan.md', 'plan\n')
    await write(root, 'docs/old name.md', 'old\n')
    await write(root, 'docs/gone.md', 'gone\n')
    await write(root, 'README.md', '# Hi\n')
    await commitAll(root, 'First')

    await write(root, 'docs/plan.md', 'plan, edited\n')
    await write(root, 'docs/sub folder/new.md', 'new\n')
    await rm(join(root, 'docs', 'gone.md'))
    await rename(join(root, 'docs', 'old name.md'), join(root, 'docs', 'new name.md'))
    await git(root, ['add', '--all', '--', 'docs/old name.md', 'docs/new name.md'])

    const result = await status(root)
    expect(result.branch).toBe('main')
    expect(result.changes).toEqual([
      { path: 'docs/gone.md', kind: 'deleted' },
      { path: 'docs/new name.md', kind: 'renamed', from: 'docs/old name.md' },
      { path: 'docs/plan.md', kind: 'modified' },
      { path: 'docs/sub folder/new.md', kind: 'new' }
    ])
  })

  it('shows a staged and then edited file once, as modified', async () => {
    await initRepo(root)
    await write(root, 'a.md', '1\n')
    await commitAll(root, 'First')
    await write(root, 'a.md', '2\n')
    await git(root, ['add', 'a.md'])
    await write(root, 'a.md', '3\n')
    expect((await status(root)).changes).toEqual([{ path: 'a.md', kind: 'modified' }])
  })

  it('sees only its own files when the project is a folder inside a repository', async () => {
    await initRepo(root)
    await write(root, 'docs/plan.md', 'plan\n')
    await write(root, 'README.md', '# Hi\n')
    await commitAll(root, 'First')
    await write(root, 'docs/plan.md', 'edited\n')
    await write(root, 'docs/notes.md', 'notes\n')
    await write(root, 'README.md', 'edited\n')
    const result = await status(join(root, 'docs'))
    expect(result).toEqual({
      repo: true,
      branch: 'main',
      changes: [
        { path: 'notes.md', kind: 'new' },
        { path: 'plan.md', kind: 'modified' }
      ]
    })
  })
})

describe('parseStatus', () => {
  it('reads porcelain v2 records: headers, changes, renames, conflicts, untracked', () => {
    const records = [
      '# branch.oid 0123456789abcdef',
      '# branch.head feature/x y',
      '# branch.upstream origin/feature/x y',
      '# branch.ab +1 -2',
      '1 .M N... 100644 100644 100644 abc def docs/a b.md',
      '1 A. N... 000000 100644 100644 000 abc new.md',
      '1 .D N... 100644 100644 000000 abc abc gone.md',
      '2 R. N... 100644 100644 100644 abc abc R100 after.md',
      'before.md',
      'u UU N... 100644 100644 100644 100644 a b c conflict.md',
      '? untracked dir/x.md',
      '! ignored.md'
    ]
    expect(parseStatus(records.join('\0') + '\0')).toEqual({
      branch: 'feature/x y',
      changes: [
        { path: 'docs/a b.md', kind: 'modified' },
        { path: 'new.md', kind: 'new' },
        { path: 'gone.md', kind: 'deleted' },
        { path: 'after.md', kind: 'renamed', from: 'before.md' },
        { path: 'conflict.md', kind: 'conflict' },
        { path: 'untracked dir/x.md', kind: 'new' }
      ]
    })
  })

  it('handles an empty repository with no branch header', () => {
    expect(parseStatus('')).toEqual({ branch: null, changes: [] })
  })
})

describe('commit', () => {
  let root: string

  beforeEach(async () => {
    root = await tempDir('proj')
    await initRepo(root)
    await write(root, 'a.md', 'a\n')
    await write(root, 'b.md', 'b\n')
    await write(root, 'c.md', 'c\n')
    await commitAll(root, 'First')
  })

  it('saves the ticked files only, new and deleted ones included', async () => {
    await write(root, 'a.md', 'a2\n')
    await write(root, 'b.md', 'b2\n')
    await rm(join(root, 'c.md'))
    await write(root, 'docs/new one.md', 'new\n')
    await git(root, ['add', 'b.md']) // staged by another tool, not ticked

    await commit(root, ['a.md', 'c.md', 'docs/new one.md'], 'Edit a, drop c, add one')

    expect(await log(root)).toEqual(['Edit a, drop c, add one', 'First'])
    expect(await lastCommitFiles(root)).toEqual(['a.md', 'c.md', 'docs/new one.md'])
    expect((await status(root)).changes).toEqual([{ path: 'b.md', kind: 'modified' }])
  })

  it('keeps the whole message and treats wildcard characters in names literally', async () => {
    await write(root, 'a[1].md', 'brackets\n')
    await write(root, 'a1.md', 'a1\n') // what the glob a[1].md would match instead
    await commit(root, ['a[1].md'], 'First line\n\nMore detail.')
    expect(await lastCommitFiles(root)).toEqual(['a[1].md'])
    const body = await git(root, ['log', '-1', '--format=%B'])
    expect(body.trim()).toBe('First line\n\nMore detail.')
  })

  it('refuses an empty selection or message', async () => {
    await write(root, 'a.md', 'a2\n')
    await expect(commit(root, [], 'x')).rejects.toThrow(/at least one/)
    await expect(commit(root, ['a.md'], '  ')).rejects.toThrow(/message/)
    expect(await log(root)).toEqual(['First'])
  })
})

describe('identity', () => {
  it('is empty until set, then saved for every repository', async () => {
    const one = await tempDir('one')
    const two = await tempDir('two')
    await git(one, ['init', '--quiet'])
    await git(two, ['init', '--quiet'])
    await expect(identity(one)).resolves.toEqual({ name: '', email: '' })

    await setIdentity(one, { name: ' Ada Lovelace ', email: 'ada@example.com' })
    const expected = { name: 'Ada Lovelace', email: 'ada@example.com' }
    await expect(identity(one)).resolves.toEqual(expected)
    await expect(identity(two)).resolves.toEqual(expected)
    const written = await readFile(process.env['GIT_CONFIG_GLOBAL']!, 'utf8')
    expect(written).toContain('name = Ada Lovelace')
  })

  it('refuses a missing name or email', async () => {
    const root = await tempDir('proj')
    await git(root, ['init', '--quiet'])
    await expect(setIdentity(root, { name: '', email: 'a@b.c' })).rejects.toThrow(/required/)
    await expect(setIdentity(root, { name: 'A', email: ' ' })).rejects.toThrow(/required/)
  })
})
