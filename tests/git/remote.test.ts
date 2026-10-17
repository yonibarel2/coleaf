import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resolveConflict, resolveFile } from '../../src/main/git/conflicts'
import {
  authEnv,
  cancelSync,
  failure,
  finishSync,
  kindOfUrl,
  remoteInfo,
  sync
} from '../../src/main/git/remote'
import { isMerging, status } from '../../src/main/git/repo'
import { git, GitError } from '../../src/main/git/run'
import {
  bareRepo,
  clone,
  commitAll,
  initRepo,
  isolateGitConfig,
  log,
  pushAll,
  read,
  tempDir,
  write
} from './temp-repo'

beforeAll(isolateGitConfig)

const slow = { timeout: 60_000 }

// "GitHub" (a bare repository), my clone and a teammate's clone.
let origin: string
let mine: string
let theirs: string

async function setUpRepos(): Promise<void> {
  const base = await tempDir()
  origin = join(base, 'origin.git')
  mine = join(base, 'mine')
  theirs = join(base, 'theirs')
  await bareRepo(origin)
  const seed = join(base, 'seed')
  await clone(origin, seed)
  await write(seed, 'docs/plan.md', '# Plan\n\nFirst line.\n\nLast line.\n')
  await write(seed, 'notes.txt', 'notes\n')
  await pushAll(seed, 'Start')
  await clone(origin, mine)
  await clone(origin, theirs)
}

describe('sync', () => {
  beforeEach(setUpRepos)

  it('saves a version with the ticked files and sends it', slow, async () => {
    await write(mine, 'docs/plan.md', '# Plan\n\nMy line.\n\nLast line.\n')
    await write(mine, 'docs/other.md', 'not ticked\n')
    const outcome = await sync(mine, { paths: ['docs/plan.md'], message: 'Edit', token: null })
    expect(outcome).toEqual({ kind: 'synced', pulled: false, pushed: true })
    expect(await log(origin)).toEqual(['Edit', 'Start'])
    expect((await status(mine)).changes).toEqual([{ path: 'docs/other.md', kind: 'new' }])
  })

  it('gets the latest when there is nothing to save', slow, async () => {
    await write(theirs, 'docs/new.md', 'from a teammate\n')
    await pushAll(theirs, 'Teammate adds a file')
    const outcome = await sync(mine, { paths: [], message: '', token: null })
    expect(outcome).toEqual({ kind: 'synced', pulled: true, pushed: false })
    expect(await read(mine, 'docs/new.md')).toBe('from a teammate\n')
    expect(await sync(mine, { paths: [], message: '', token: null })).toEqual({
      kind: 'synced',
      pulled: false,
      pushed: false
    })
  })

  it('merges others changes to other lines and sends the result', slow, async () => {
    await write(theirs, 'docs/plan.md', '# Plan\n\nFirst line.\n\nTheir last line.\n')
    await pushAll(theirs, 'Teammate edits the end')
    await write(mine, 'docs/plan.md', '# Plan\n\nMy first line.\n\nLast line.\n')
    const outcome = await sync(mine, { paths: ['docs/plan.md'], message: 'Edit', token: null })
    expect(outcome).toEqual({ kind: 'synced', pulled: true, pushed: true })
    expect(await read(mine, 'docs/plan.md')).toBe('# Plan\n\nMy first line.\n\nTheir last line.\n')
    expect(await log(origin)).toHaveLength(4) // start, theirs, mine, the merge
  })

  it('stops on a conflict; Mine, Theirs or Both finish it', slow, async () => {
    await write(theirs, 'docs/plan.md', '# Plan\n\nTheir line.\n\nLast line.\n')
    await pushAll(theirs, 'Teammate edits')
    await write(mine, 'docs/plan.md', '# Plan\n\nMy line.\n\nLast line.\n')
    const outcome = await sync(mine, { paths: ['docs/plan.md'], message: 'Edit', token: null })
    expect(outcome).toEqual({ kind: 'conflicts', pulled: true, files: ['docs/plan.md'] })
    const during = await status(mine)
    expect(during.merging).toBe(true)
    expect(during.changes).toEqual([{ path: 'docs/plan.md', kind: 'conflict' }])
    expect(await finishSync(mine, null)).toEqual({
      kind: 'conflicts',
      pulled: false,
      files: ['docs/plan.md']
    })

    await resolveConflict(mine, 'docs/plan.md', ['both'])
    expect(await read(mine, 'docs/plan.md')).toBe('# Plan\n\nMy line.\nTheir line.\n\nLast line.\n')
    expect(await finishSync(mine, null)).toEqual({ kind: 'synced', pulled: true, pushed: true })
    expect(await isMerging(mine)).toBe(false)
    expect((await status(mine)).changes).toEqual([])
    expect(await log(origin)).toHaveLength(4)
  })

  it('settles a conflicted file as a whole, and lets the user cancel', slow, async () => {
    await write(theirs, 'notes.txt', 'their notes\n')
    await pushAll(theirs, 'Teammate edits notes')
    await write(mine, 'notes.txt', 'my notes\n')
    const outcome = await sync(mine, { paths: ['notes.txt'], message: 'Notes', token: null })
    expect(outcome.kind).toBe('conflicts')

    await cancelSync(mine)
    expect(await isMerging(mine)).toBe(false)
    expect(await read(mine, 'notes.txt')).toBe('my notes\n')
    expect(await log(mine)).toEqual(['Notes', 'Start'])

    expect((await sync(mine, { paths: [], message: '', token: null })).kind).toBe('conflicts')
    await resolveFile(mine, 'notes.txt', 'theirs')
    expect(await read(mine, 'notes.txt')).toBe('their notes\n')
    expect((await finishSync(mine, null)).kind).toBe('synced')
    expect(await log(origin)).toHaveLength(4) // start, theirs, mine, the merge
  })

  it('keeps a file one side deleted only when that side is chosen', slow, async () => {
    await git(theirs, ['rm', '--quiet', 'notes.txt'])
    await pushAll(theirs, 'Teammate drops notes')
    await write(mine, 'notes.txt', 'my notes\n')
    expect((await sync(mine, { paths: ['notes.txt'], message: 'Notes', token: null })).kind).toBe(
      'conflicts'
    )
    await resolveFile(mine, 'notes.txt', 'theirs')
    expect((await status(mine)).changes.map((c) => c.kind)).not.toContain('conflict')
    expect((await finishSync(mine, null)).kind).toBe('synced')
    await expect(read(mine, 'notes.txt')).rejects.toThrow()
  })

  it('refuses to bring in changes over an edited file that was not ticked', slow, async () => {
    await write(theirs, 'docs/plan.md', '# Plan\n\nTheir line.\n\nLast line.\n')
    await pushAll(theirs, 'Teammate edits')
    await write(mine, 'docs/plan.md', '# Plan\n\nMy line.\n\nLast line.\n')
    const outcome = await sync(mine, { paths: [], message: '', token: null })
    expect(outcome.kind).toBe('error')
    expect(outcome.message).toMatch(/docs\/plan\.md, which you edited but did not tick/)
    expect(await isMerging(mine)).toBe(false)
  })

  it('only saves when the project has no online copy', slow, async () => {
    const root = await tempDir('alone')
    await initRepo(root)
    await write(root, 'a.md', 'a\n')
    expect(await sync(root, { paths: ['a.md'], message: 'First', token: null })).toEqual({
      kind: 'saved',
      pulled: false
    })
    expect(await log(root)).toEqual(['First'])
  })

  it('asks for a sign-in on GitHub over HTTPS, and declines SSH', slow, async () => {
    const root = await tempDir('alone')
    await initRepo(root)
    await write(root, 'a.md', 'a\n')
    await commitAll(root, 'First')
    await git(root, ['remote', 'add', 'origin', 'https://github.com/someone/repo.git'])
    expect(await sync(root, { paths: [], message: '', token: null })).toEqual({
      kind: 'sign-in',
      pulled: false
    })
    await git(root, ['remote', 'set-url', 'origin', 'git@github.com:someone/repo.git'])
    expect(await sync(root, { paths: [], message: '', token: null })).toEqual({
      kind: 'ssh',
      pulled: false
    })
  })
})

describe('remoteInfo', () => {
  beforeEach(setUpRepos)

  it('prefers the upstream remote, then origin', slow, async () => {
    expect(await remoteInfo(mine)).toMatchObject({ name: 'origin', kind: 'local' })
    await git(mine, ['remote', 'add', 'other', 'https://github.com/x/y.git'])
    expect((await remoteInfo(mine))?.name).toBe('origin') // main's upstream is origin/main
    await git(mine, ['branch', '--unset-upstream'])
    expect((await remoteInfo(mine))?.name).toBe('origin')
    await git(mine, ['remote', 'remove', 'origin'])
    expect(await remoteInfo(mine)).toMatchObject({ name: 'other', kind: 'github' })
    await git(mine, ['remote', 'remove', 'other'])
    expect(await remoteInfo(mine)).toBeNull()
  })
})

describe('kindOfUrl', () => {
  it.each([
    ['https://github.com/x/y.git', 'github'],
    ['https://www.github.com/x/y', 'github'],
    ['https://gitlab.com/x/y.git', 'https'],
    ['http://example.com/x.git', 'https'],
    ['git@github.com:x/y.git', 'ssh'],
    ['ssh://git@github.com/x/y.git', 'ssh'],
    ['github.com:x/y.git', 'ssh'],
    ['C:\\repos\\origin.git', 'local'],
    ['c:/repos/origin.git', 'local'],
    ['/home/me/origin.git', 'local'],
    ['file:///home/me/origin.git', 'local'],
    ['../origin.git', 'local']
  ])('%s → %s', (url, kind) => {
    expect(kindOfUrl(url)).toBe(kind)
  })
})

describe('authEnv', () => {
  it('scopes the token to github.com and passes it through the environment only', () => {
    const env = authEnv(
      { name: 'origin', url: 'https://github.com/x/y.git', kind: 'github' },
      'tok'
    )
    expect(env).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from('x-access-token:tok').toString('base64')}`
    })
  })

  it('sends nothing to other hosts, and nothing when signed out', () => {
    expect(
      authEnv({ name: 'origin', url: 'https://gitlab.com/x/y.git', kind: 'https' }, 'tok')
    ).toEqual({})
    expect(
      authEnv({ name: 'origin', url: 'https://github.com/x/y.git', kind: 'github' }, null)
    ).toEqual({})
  })
})

describe('failure', () => {
  const gitError = (stderr: string): GitError => new GitError(['push'], 128, stderr)

  it('sorts what Git said into outcomes', () => {
    expect(
      failure(
        gitError(
          "fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com"
        ),
        false
      ).kind
    ).toBe('offline')
    expect(
      failure(
        gitError(
          "remote: Permission to x/y.git denied to someone.\nfatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403"
        ),
        true
      )
    ).toMatchObject({ kind: 'denied', pulled: true })
    expect(
      failure(
        gitError(
          'fatal: could not read Username for https://github.com: terminal prompts disabled'
        ),
        false
      ).kind
    ).toBe('denied')
    expect(
      failure(
        gitError(
          ' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs'
        ),
        false
      )
    ).toMatchObject({ kind: 'error', message: expect.stringMatching(/Sync again/) })
    expect(
      failure(
        gitError(
          'error: Your local changes to the following files would be overwritten by merge:\n\tdocs/a.md\n\tdocs/b.md\nPlease commit your changes or stash them before you merge.\nAborting'
        ),
        false
      ).message
    ).toBe(
      'Others changed docs/a.md, docs/b.md, which you edited but did not tick. Tick them and Sync again.'
    )
    expect(failure(new Error('boom'), false)).toEqual({
      kind: 'error',
      pulled: false,
      message: 'boom'
    })
  })
})
