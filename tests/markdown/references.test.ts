import { Transform } from '@tiptap/pm/transform'
import type { Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { hrefOfMark } from '../../src/renderer/editor/nodes'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

// Footnotes, reference links and images: shown as what they stand for, written back as they were.

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))

function nodesOf(doc: PmNode, type: string): { node: PmNode; pos: number }[] {
  const found: { node: PmNode; pos: number }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === type) found.push({ node, pos })
  })
  return found
}

describe('footnotes', () => {
  const text = 'Text[^1] and more[^note].\n\n[^1]: The note.\n\n[^note]: A **named** one.\n'

  it('opens references as superscripts and notes as blocks of their own', () => {
    const doc = markdownToDoc(text, schema)
    const refs = nodesOf(doc, 'footnoteRef').map(({ node }) => node.attrs['label'])
    expect(refs).toEqual(['1', 'note'])
    const defs = nodesOf(doc, 'footnoteDef')
    expect(defs.map(({ node }) => node.attrs['label'])).toEqual(['1', 'note'])
    expect(defs[1].node.firstChild?.type.name).toBe('paragraph')
    expect(defs[1].node.textContent).toBe('A named one.')
    expect(roundTrip(text)).toBe(text)
  })

  it('saves an edited note', () => {
    const doc = markdownToDoc(text, schema)
    let at = -1
    doc.descendants((node, pos) => {
      if (node.isText && node.text === ' one.') at = pos + ' one.'.length
    })
    const edited = new Transform(doc).replaceWith(at, at, schema.text(' Edited.')).doc
    expect(docToMarkdown(edited)).toBe(text.replace('one.', 'one. Edited.'))
  })
})

describe('reference links and images', () => {
  const text =
    '[text][label], [label][] and ![alt text][pic]; see https://x.y too.\n\n' +
    '[label]: https://example.com\n[pic]: images/pic.png\n'

  it('shows reference links as links to their definition', () => {
    const paragraph = markdownToDoc(text, schema).firstChild!
    const links = [] as (string | null)[]
    paragraph.forEach((node) => {
      const raw = node.marks.find((mark) => mark.type.name === 'rawMark')
      if (raw) links.push(hrefOfMark(raw))
    })
    expect(links).toEqual(['https://example.com', 'https://example.com', 'https://x.y'])
  })

  it('shows a reference image as its picture and the definitions small', () => {
    const doc = markdownToDoc(text, schema)
    const [image] = nodesOf(doc, 'rawInline')
    expect(image.node.attrs['node']).toMatchObject({
      type: 'imageReference',
      alt: 'alt text',
      data: { coleafUrl: 'images/pic.png' }
    })
    expect(image.node.attrs['source']).toBe('![alt text][pic]')
    const [definitions] = nodesOf(doc, 'rawBlock')
    expect(definitions.node.attrs['kind']).toBe('definitions')
    expect(roundTrip(text)).toBe(text)
  })

  it('leaves a reference without a definition as the plain text it is', () => {
    const paragraph = markdownToDoc('[text][missing]\n', schema).firstChild!
    expect(paragraph.firstChild!.text).toBe('[text][missing]')
    expect(paragraph.firstChild!.marks).toEqual([])
    expect(roundTrip('[text][missing]\n')).toBe('[text][missing]\n')
  })
})
