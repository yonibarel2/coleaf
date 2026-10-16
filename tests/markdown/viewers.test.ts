import { Transform } from '@tiptap/pm/transform'
import type { Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

// The Stage 1b viewers (docs/plan.md): syntax shown formatted, saved back as it was.

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))

// Every node of a type, with its position.
function nodesOf(doc: PmNode, type: string): { node: PmNode; pos: number }[] {
  const found: { node: PmNode; pos: number }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === type) found.push({ node, pos })
  })
  return found
}

describe('task lists', () => {
  const text = '- [ ] to do\n- [x] done\n- plain\n'

  it('opens the boxes as ticks on the items and writes them back', () => {
    const items = nodesOf(markdownToDoc(text, schema), 'listItem')
    expect(items.map(({ node }) => node.attrs['checked'])).toEqual([false, true, null])
    expect(roundTrip(text)).toBe(text)
  })

  it('saves a ticked box as [x]', () => {
    const doc = markdownToDoc(text, schema)
    const { node, pos } = nodesOf(doc, 'listItem')[0]
    const ticked = new Transform(doc).setNodeMarkup(pos, undefined, {
      ...node.attrs,
      checked: true
    })
    expect(docToMarkdown(ticked.doc)).toBe('- [x] to do\n- [x] done\n- plain\n')
  })

  it('keeps the escape of an item starting with a parenthesis', () => {
    expect(roundTrip('- [ ] \\(Optional)\n')).toBe('- [ ] \\(Optional)\n')
  })
})

describe('strikethrough', () => {
  it('shows ~~text~~ struck through and leaves ~text~ alone', () => {
    const doc = markdownToDoc('~~text~~ and ~text~\n', schema)
    const struck = doc.firstChild!.child(0)
    expect(struck.text).toBe('text')
    expect(struck.marks.map((mark) => mark.type.name)).toEqual(['strike'])
    expect(doc.firstChild!.child(1).text).toBe(' and ~text~')
    expect(roundTrip('~~text~~ and ~text~\n')).toBe('~~text~~ and ~text~\n')
  })

  it('writes a struck word typed in the editor as ~~word~~', () => {
    const { nodes, marks } = schema
    const doc = nodes.doc.create(null, [
      nodes.paragraph.create(null, [
        schema.text('a '),
        schema.text('gone', [marks.strike.create()]),
        schema.text(' word')
      ])
    ])
    expect(docToMarkdown(doc)).toBe('a ~~gone~~ word\n')
  })
})
