import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectIgnore } from '../../src/main/files/ignore'
import { MarkdownIndex } from '../../src/main/files/markdown-index'

let root: string
let index: MarkdownIndex

async function file(path: string, content = ''): Promise<void> {
  await mkdir(join(root, path, '..'), { recursive: true })
  await writeFile(join(root, path), content)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'coleaf-index-'))
  await file('README.md')
  await file('docs/plan.md')
  await file('a/b/c/deep.md')
  await file('src/index.ts')
  await file('notes/upper.MD')
  await file('other/text.markdown')
  await file('.git/inside.md')
  await mkdir(join(root, 'images'))
  index = new MarkdownIndex(root, new ProjectIgnore(root))
})

afterEach(() => rm(root, { recursive: true, force: true }))

describe('MarkdownIndex', () => {
  it('knows nothing before the scan and everything after it', async () => {
    expect(index.complete).toBe(false)
    expect(index.status('src')).toBeUndefined()
    await index.scan()
    expect(index.complete).toBe(true)
    expect(index.status('')).toBe(true)
    expect(index.status('docs')).toBe(true)
    expect(index.status('a')).toBe(true)
    expect(index.status('a/b')).toBe(true)
    expect(index.status('a/b/c')).toBe(true)
    expect(index.status('notes')).toBe(true)
    expect(index.status('other')).toBe(true)
    expect(index.status('src')).toBe(false)
    expect(index.status('images')).toBe(false)
  })

  it('never looks inside hidden folders', async () => {
    await index.scan()
    expect(index.status('.git')).toBe(false)
  })

  it('refreshes one folder when Markdown is added or removed', async () => {
    await index.scan()
    await file('src/new.md')
    await index.refresh('src')
    expect(index.status('src')).toBe(true)
    await rm(join(root, 'src', 'new.md'))
    await index.refresh('src')
    expect(index.status('src')).toBe(false)
  })

  it('prunes a removed subtree and scans a new one', async () => {
    await index.scan()
    index.prune('a')
    expect(index.status('a')).toBe(false)
    expect(index.status('a/b/c')).toBe(false)
    await file('fresh/x/y.md')
    await index.scanSubtree('fresh')
    expect(index.status('fresh')).toBe(true)
    expect(index.status('fresh/x')).toBe(true)
  })

  it('stops a scan that is cancelled', async () => {
    const scan = index.scan()
    index.cancel()
    await scan
    expect(index.complete).toBe(false)
  })
})
