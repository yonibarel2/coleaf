import { describe, expect, it } from 'vitest'
import { highlighter, previewKindOf } from '../../src/renderer/editor/highlight'
import { languages } from '../../src/renderer/editor/languages'

describe('code highlighting', () => {
  it('knows every language of the picker, and the aliases people write', () => {
    for (const [id] of languages) {
      if (id === '' || previewKindOf(id) !== null || id === 'math') continue
      expect(highlighter.registered(id), id).toBe(true)
    }
    for (const alias of ['js', 'ts', 'sh', 'html', 'yml']) {
      expect(highlighter.registered(alias), alias).toBe(true)
    }
  })

  it('colors code by its language and leaves unknown languages plain', () => {
    const tree = JSON.stringify(highlighter.highlight('js', 'const a = "b"'))
    expect(tree).toContain('hljs-keyword')
    expect(tree).toContain('hljs-string')
    expect(highlighter.registered('mermaid')).toBe(false)
    expect(highlighter.registered('elixir')).toBe(false)
    expect(highlighter.highlightAuto()).toEqual({ type: 'root', children: [] })
  })

  it('previews Mermaid blocks only', () => {
    expect(previewKindOf('mermaid')).toBe('mermaid')
    expect(previewKindOf('js')).toBeNull()
    expect(previewKindOf(null)).toBeNull()
  })
})
