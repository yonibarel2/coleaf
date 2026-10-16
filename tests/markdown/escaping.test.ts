import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))

// A paragraph as a user could have typed it, letter by letter.
const typed = (...lines: string[]): string =>
  docToMarkdown(
    schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(
        null,
        lines.flatMap((line, index) =>
          index === 0 ? [schema.text(line)] : [schema.nodes.softBreak.create(), schema.text(line)]
        )
      )
    ])
  )

describe('escaping', () => {
  it('leaves syntax other tools rely on alone', () => {
    const kept = [
      'See [[Page name]] and [[Page|alias]], or ![[file]].\n',
      '> [!NOTE]\n> Alerts stay.\n',
      'Water is H~2~O, x^2^ and ==marked==.\n',
      '[TOC] and [[_TOC_]] and [@smith2020].\n',
      '*[HTML]: HyperText Markup Language\n',
      '## Goals {#goals}\n',
      'Tom & Jerry, AT&T, 50% done.\n'
    ]
    for (const text of kept) expect(roundTrip(text)).toBe(text)
  })

  it('escapes what a typed character would otherwise turn into', () => {
    expect(typed('# not a heading')).toBe('\\# not a heading\n')
    expect(typed('- not a list')).toBe('\\- not a list\n')
    expect(typed('1. not a list')).toBe('1\\. not a list\n')
    expect(typed('> not a quote')).toBe('\\> not a quote\n')
    expect(typed('two *stars* here')).toBe('two \\*stars\\* here\n')
    expect(typed('a [link](x) typed')).toBe('a \\[link]\\(x) typed\n')
    expect(typed('a <b>tag</b> typed')).toBe('a \\<b>tag\\</b> typed\n')
    expect(typed('a `tick typed')).toBe('a \\`tick typed\n')
    expect(typed('ends with a backslash \\')).toBe('ends with a backslash \\\\\n')
  })

  it('escapes line starts after a soft break too', () => {
    expect(typed('first line', '# second line')).toBe('first line\n\\# second line\n')
    expect(typed('first line', '- second line')).toBe('first line\n\\- second line\n')
  })

  it('keeps a backslash that ends a text run, whatever follows it', () => {
    const { nodes, marks } = schema
    const boldItalic = [marks.bold.create(), marks.italic.create()]
    const doc = nodes.doc.create(null, [
      nodes.paragraph.create(null, [
        schema.text('\\a'),
        schema.text('a', boldItalic),
        schema.text('a and \\'),
        schema.text('b', [marks.italic.create()])
      ])
    ])
    const saved = docToMarkdown(doc)
    expect(markdownToDoc(saved, schema).eq(doc), saved).toBe(true)
  })

  it('keeps brackets and stars that do not form anything', () => {
    expect(typed('a [bracket] and a lone * star')).toBe('a [bracket] and a lone * star\n')
  })
})
