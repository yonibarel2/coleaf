import { describe, expect, it } from 'vitest'
import { headingSlugs, resolveLink } from '../../src/renderer/editor/link'
import { imageUrl, resolveRepoPath } from '../../src/renderer/editor/paths'

describe('resolveRepoPath', () => {
  it('resolves against the document folder, or the root after a slash', () => {
    expect(resolveRepoPath('docs/plan.md', 'images/a.png')).toBe('docs/images/a.png')
    expect(resolveRepoPath('docs/plan.md', './a.png')).toBe('docs/a.png')
    expect(resolveRepoPath('docs/plan.md', '../README.md')).toBe('README.md')
    expect(resolveRepoPath('docs/plan.md', '/README.md')).toBe('README.md')
    expect(resolveRepoPath('README.md', 'docs/plan.md')).toBe('docs/plan.md')
  })

  it('decodes escapes and drops a query or fragment', () => {
    expect(resolveRepoPath('a.md', 'my%20file.md')).toBe('my file.md')
    expect(resolveRepoPath('a.md', 'b.md?x=1#top')).toBe('b.md')
    expect(resolveRepoPath('a.md', 'logo.png#gh-dark-mode-only')).toBe('logo.png')
  })

  it('refuses paths that leave the project', () => {
    expect(resolveRepoPath('docs/plan.md', '../../x.md')).toBeNull()
    expect(resolveRepoPath('a.md', '/../x.md')).toBeNull()
    expect(resolveRepoPath('a.md', '%E0%A4%A')).toBeNull() // a broken escape
    expect(resolveRepoPath('a.md', '')).toBeNull()
    expect(resolveRepoPath('a.md', '/')).toBeNull()
  })
})

describe('resolveLink', () => {
  it('opens web addresses in the browser and nothing else outside the project', () => {
    expect(resolveLink('a.md', 'https://x.y/z')).toEqual({ kind: 'web', url: 'https://x.y/z' })
    expect(resolveLink('a.md', 'http://x.y')).toEqual({ kind: 'web', url: 'http://x.y' })
    expect(resolveLink('a.md', 'mailto:a@b.c')).toEqual({ kind: 'web', url: 'mailto:a@b.c' })
    expect(resolveLink('a.md', 'ftp://x.y')).toBeNull()
    expect(resolveLink('a.md', 'file:///C:/x.md')).toBeNull()
    expect(resolveLink('a.md', 'C:\\x.md')).toBeNull()
  })

  it('opens Markdown files of the project, with their heading', () => {
    expect(resolveLink('README.md', 'docs/plan.md')).toEqual({
      kind: 'file',
      path: 'docs/plan.md',
      fragment: null
    })
    expect(resolveLink('docs/a.md', 'plan.md#design')).toEqual({
      kind: 'file',
      path: 'docs/plan.md',
      fragment: 'design'
    })
    expect(resolveLink('docs/a.md', '#goals')).toEqual({
      kind: 'file',
      path: 'docs/a.md',
      fragment: 'goals'
    })
    expect(resolveLink('docs/a.md', '/README.md#top%20x')).toEqual({
      kind: 'file',
      path: 'README.md',
      fragment: 'top x'
    })
    expect(resolveLink('docs/a.md', 'notes.markdown')?.kind).toBe('file')
  })

  it('does nothing for other repo files or paths that leave the project', () => {
    expect(resolveLink('README.md', 'src/index.ts')).toBeNull()
    expect(resolveLink('README.md', 'docs/')).toBeNull()
    expect(resolveLink('docs/a.md', '../../x.md')).toBeNull()
  })
})

describe('headingSlugs', () => {
  it('makes GitHub anchors, numbering repeats', () => {
    expect(
      headingSlugs(['Stage 1 – Core editor + basic Git', 'Goal', 'Goal', 'C# & .NET!', 'a_b-c'])
    ).toEqual(['stage-1--core-editor--basic-git', 'goal', 'goal-1', 'c--net', 'a_b-c'])
  })
})

describe('imageUrl', () => {
  it('serves repo pictures through the image scheme and https as it is', () => {
    expect(imageUrl('docs/plan.md', 'images/a.png')).toBe(
      'coleaf-image://project/docs/images/a.png'
    )
    expect(imageUrl('docs/plan.md', '/my pic.png')).toBe('coleaf-image://project/my%20pic.png')
    expect(imageUrl('docs/plan.md', 'logo.png#gh-dark-mode-only')).toBe(
      'coleaf-image://project/docs/logo.png'
    )
    expect(imageUrl('a.md', 'https://x.y/p.png')).toBe('https://x.y/p.png')
  })

  it('shows nothing for other schemes or paths that leave the project', () => {
    expect(imageUrl('a.md', 'http://x.y/p.png')).toBeNull()
    expect(imageUrl('a.md', 'data:image/png;base64,AAAA')).toBeNull()
    expect(imageUrl('a.md', 'file:///C:/p.png')).toBeNull()
    expect(imageUrl('docs/a.md', '../../p.png')).toBeNull()
    expect(imageUrl('a.md', null)).toBeNull()
  })
})
