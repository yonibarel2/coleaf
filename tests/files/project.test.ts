import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  compareEntries,
  isMarkdownName,
  listDirectory,
  resolveInside
} from '../../src/main/files/project'
import type { TreeEntry } from '../../src/preload/contract'

const ignoresCase = process.platform === 'win32' || process.platform === 'darwin'
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

let base: string // holds the project root and a sibling folder next to it
let root: string

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), 'coleaf-'))
  root = join(base, 'proj')
  await mkdir(join(root, 'docs'), { recursive: true })
  await mkdir(join(root, 'images'))
  await mkdir(join(root, 'src'))
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'docs', 'plan.md'), '')
  await writeFile(join(root, 'docs', 'notes.markdown'), '')
  await writeFile(join(root, 'README.md'), '')
  await writeFile(join(root, 'package.json'), '')
  await writeFile(join(root, 'src', 'index.ts'), '')
  await writeFile(join(root, '.git', 'HEAD'), '')
  await writeFile(join(root, 'Thumbs.db'), '')
  // A sibling whose name starts with the root's name: a string-prefix check would accept it.
  await mkdir(join(base, 'proj-other'))
  await symlink(join(base, 'proj-other'), join(root, 'escape'), linkType)
  await symlink(join(root, 'docs'), join(root, 'docs-link'), linkType)
})

afterAll(() => rm(base, { recursive: true, force: true }))

describe('listDirectory', () => {
  it('lists the root with folders first and system entries hidden', async () => {
    const entries = await listDirectory(root, '')
    expect(entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
      'dir:docs',
      'dir:docs-link',
      'dir:escape',
      'dir:images',
      'dir:src',
      'file:package.json',
      'file:README.md'
    ])
  })

  it('marks .md and .markdown files as Markdown', async () => {
    const byName = Object.fromEntries((await listDirectory(root, 'docs')).map((e) => [e.name, e]))
    expect(byName['plan.md']).toMatchObject({ path: 'docs/plan.md', isMarkdown: true })
    expect(byName['notes.markdown']).toMatchObject({
      path: 'docs/notes.markdown',
      isMarkdown: true
    })
    const rootByName = Object.fromEntries((await listDirectory(root, '')).map((e) => [e.name, e]))
    expect(rootByName['package.json'].isMarkdown).toBe(false)
    expect(rootByName['docs'].isMarkdown).toBe(false)
  })

  it('rejects paths that leave the project', async () => {
    await expect(listDirectory(root, '..')).rejects.toThrow(/outside/)
    await expect(listDirectory(root, '../proj-other')).rejects.toThrow(/outside/)
    await expect(listDirectory(root, 'docs/../../proj-other')).rejects.toThrow(/outside/)
    await expect(listDirectory(root, base)).rejects.toThrow(/outside/)
  })

  it('rejects a link to a sibling folder, even one whose name starts with the root', async () => {
    await expect(listDirectory(root, 'escape')).rejects.toThrow(/outside/)
  })

  it('follows a link that stays inside the project', async () => {
    const names = (await listDirectory(root, 'docs-link')).map((e) => e.name)
    expect(names).toEqual(['notes.markdown', 'plan.md'])
  })
})

describe('resolveInside', () => {
  it('resolves the root itself and nested folders', async () => {
    await expect(resolveInside(root, '')).resolves.toBe(root)
    await expect(resolveInside(root, 'docs')).resolves.toBe(join(root, 'docs'))
  })

  it.skipIf(!ignoresCase)('ignores letter case where the file system does', async () => {
    const shouted = root.toUpperCase()
    await expect(resolveInside(shouted, 'docs-link')).resolves.toBe(join(shouted, 'docs-link'))
    await expect(resolveInside(shouted, 'escape')).rejects.toThrow(/outside/)
  })
})

describe('isMarkdownName', () => {
  it.each([
    ['plan.md', true],
    ['PLAN.MD', true],
    ['notes.markdown', true],
    ['package.json', false],
    ['md', false]
  ])('%s → %s', (name, expected) => {
    expect(isMarkdownName(name)).toBe(expected)
  })
})

describe('compareEntries', () => {
  it('puts folders first and sorts names naturally, ignoring case', () => {
    const entry = (name: string, kind: TreeEntry['kind']): TreeEntry => ({
      name,
      path: name,
      kind,
      isMarkdown: false
    })
    const sorted = [
      entry('b.md', 'file'),
      entry('file10.md', 'file'),
      entry('zeta', 'dir'),
      entry('file2.md', 'file'),
      entry('Alpha', 'dir'),
      entry('a.md', 'file')
    ].sort(compareEntries)
    expect(sorted.map((e) => e.name)).toEqual([
      'Alpha',
      'zeta',
      'a.md',
      'b.md',
      'file2.md',
      'file10.md'
    ])
  })
})
