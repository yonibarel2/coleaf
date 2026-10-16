import { Transform } from '@tiptap/pm/transform'
import type { Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { parseTag, tagFilter } from '../../src/renderer/markdown/htmlTags'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

// HTML inside Markdown: tags paired into marks, lone tags as chips, all written back as they were.

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))

// The inline content of the first paragraph: text with its HTML marks, and chips.
function inlineOf(markdown: string): string[] {
  const paragraph = markdownToDoc(markdown, schema).firstChild!
  const parts: string[] = []
  paragraph.forEach((node: PmNode) => {
    if (node.type.name === 'htmlInline') parts.push(`chip(${node.attrs['html']})`)
    else if (node.isText) {
      const wraps = node.marks
        .filter((mark) => mark.type.name === 'htmlMark')
        .map((mark) => `${mark.attrs['open']}…${mark.attrs['close']}`)
      parts.push(wraps.length ? `${node.text}[${wraps.join(' ')}]` : node.text!)
    } else parts.push(node.type.name)
  })
  return parts
}

describe('inline HTML tags', () => {
  it('tells opening, closing, lone tags and comments apart', () => {
    expect(parseTag('<sub>')).toEqual({ kind: 'open', name: 'sub' })
    expect(parseTag('<a href="x" title="y">')).toEqual({ kind: 'open', name: 'a' })
    expect(parseTag('</SUB>')).toEqual({ kind: 'close', name: 'sub' })
    expect(parseTag('<br>')).toEqual({ kind: 'void', name: 'br' })
    expect(parseTag('<img src="a.png" />')).toEqual({ kind: 'void', name: 'img' })
    expect(parseTag('<span/>')).toEqual({ kind: 'void', name: 'span' })
    expect(parseTag('<!-- note -->')).toEqual({ kind: 'comment', name: '' })
    expect(parseTag('<?php ?>')).toEqual({ kind: 'other', name: '' })
  })

  it('shows GitHub`s disallowed tags as text', () => {
    expect(tagFilter('<script>alert(1)</script>')).toBe('&lt;script>alert(1)&lt;/script>')
    expect(tagFilter('<style>body {}</style>')).toBe('&lt;style>body {}&lt;/style>')
    expect(tagFilter('a <iframe src="x"></iframe> b')).toBe('a &lt;iframe src="x">&lt;/iframe> b')
    expect(tagFilter('<scripting>')).toBe('<scripting>')
    expect(tagFilter('<b>fine</b>')).toBe('<b>fine</b>')
  })
})

describe('inline HTML in a paragraph', () => {
  it('pairs tags around their text as marks and keeps the text editable', () => {
    expect(inlineOf('Text with <span>html</span> and <b>bold</b>.\n')).toEqual([
      'Text with ',
      'html[<span>…</span>]',
      ' and ',
      'bold[<b>…</b>]',
      '.'
    ])
    expect(inlineOf('H<sub>2</sub>O\n')).toEqual(['H', '2[<sub>…</sub>]', 'O'])
  })

  it('nests pairs, also of the same tag', () => {
    expect(inlineOf('<b><i>x</i></b>\n')).toEqual(['x[<b>…</b> <i>…</i>]'])
    expect(inlineOf('<span>a<span>b</span>c</span>\n')).toEqual([
      'a[<span>…</span>]',
      'b[<span>…</span> <span>…</span>]',
      'c[<span>…</span>]'
    ])
  })

  it('keeps lone tags, comments and empty pairs as chips', () => {
    expect(inlineOf('a<br>b\n')).toEqual(['a', 'chip(<br>)', 'b'])
    expect(inlineOf('Text <!-- inline note --> here.\n')).toEqual([
      'Text ',
      'chip(<!-- inline note -->)',
      ' here.'
    ])
    expect(inlineOf('<a name="section"></a>\n')).toEqual(['chip(<a name="section"></a>)'])
    expect(inlineOf('open <span>only\n')).toEqual(['open ', 'chip(<span>)', 'only'])
    expect(inlineOf('close</span> only\n')).toEqual(['close', 'chip(</span>)', ' only'])
  })

  it('writes the tags back as they were, after an edit too', () => {
    const texts = [
      'Text with <span>html</span> and <b>bold</b>.\n',
      'H<sub>2</sub>O and x<sup>2</sup>\n',
      '<kbd>Ctrl</kbd>+<kbd>S</kbd>\n',
      'Line<br>break and <img src="pic.png" width="300" align="right">\n',
      '<a name="section"></a>\n',
      'Text <!-- inline note --> here.\n'
    ]
    for (const text of texts) expect(roundTrip(text)).toBe(text)

    // Typing after the 2 keeps its marks, as the editor does.
    const doc = markdownToDoc('H<sub>2</sub>O\n', schema)
    let at = -1
    let typed: PmNode | null = null
    doc.descendants((node, pos) => {
      if (node.isText && node.text === '2') {
        at = pos + 1
        typed = schema.text('0', node.marks)
      }
    })
    const edited = new Transform(doc).replaceWith(at, at, typed!).doc
    expect(docToMarkdown(edited)).toBe('H<sub>20</sub>O\n')
  })
})

describe('HTML blocks', () => {
  it('opens a block as an HTML node and writes it back', () => {
    const text = '<div align="center">\n  <p>raw html</p>\n</div>\n'
    const doc = markdownToDoc(text, schema)
    expect(doc.firstChild?.type.name).toBe('htmlBlock')
    expect(doc.firstChild?.attrs['html']).toBe('<div align="center">\n  <p>raw html</p>\n</div>')
    expect(roundTrip(text)).toBe(text)
  })
})
