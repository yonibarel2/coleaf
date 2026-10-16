import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ProjectIgnore } from '../../src/main/files/ignore'
import { MarkdownIndex } from '../../src/main/files/markdown-index'

let root: string
let index: MarkdownIndex

async function file(path: string, content = ''): Promise<void> {
  await mkdir(join(root, path, '..'), { recursive: true })
  await writeFile(join(root, path), content)
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'coleaf-ignore-'))
  await file('.gitignore', 'out/\nbuild\n*.log\n')
  await file('out/generated.md')
  await file('build/notes.md')
  await file('node_modules/pkg/README.md')
  await file('src/.gitignore', 'gen/\n')
  await file('src/gen/g.md')
  await file('src/real.md')
  await file('logs/today.log')
  index = new MarkdownIndex(root, new ProjectIgnore(root))
  await index.scan()
})

afterAll(() => rm(root, { recursive: true, force: true }))

describe('ProjectIgnore', () => {
  it('skips node_modules at any depth, never the root', () => {
    const { ignore } = index
    expect(ignore.isSkipped('')).toBe(false)
    expect(ignore.isSkipped('node_modules')).toBe(true)
    expect(ignore.isSkipped('node_modules/pkg')).toBe(true)
    expect(ignore.isSkipped('src/node_modules')).toBe(true)
  })

  it('applies the root .gitignore and nested ones relative to their folder', () => {
    const { ignore } = index
    expect(ignore.isSkipped('out')).toBe(true)
    expect(ignore.isSkipped('build')).toBe(true)
    expect(ignore.isSkipped('src/gen')).toBe(true)
    expect(ignore.isSkipped('src')).toBe(false)
    expect(ignore.isSkipped('logs')).toBe(false)
  })
})

describe('MarkdownIndex with skipped folders', () => {
  it('reports skipped folders as without Markdown, whatever they hold', () => {
    expect(index.status('node_modules')).toBe(false)
    expect(index.status('node_modules/pkg')).toBe(false)
    expect(index.status('out')).toBe(false)
    expect(index.status('build')).toBe(false)
    expect(index.status('src/gen')).toBe(false)
  })

  it('still indexes everything else', () => {
    expect(index.status('src')).toBe(true)
    expect(index.status('logs')).toBe(false)
    expect(index.status('')).toBe(true)
  })
})
