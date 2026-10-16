import { Transform } from '@tiptap/pm/transform'
import type { Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { findAlerts } from '../../src/renderer/editor/alerts'
import { schema } from '../../src/renderer/editor/extensions'
import { mathSource, renderMath } from '../../src/renderer/editor/math'
import { emojiOf } from '../../src/renderer/markdown/emoji'
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

describe('emoji', () => {
  it('shows the shortcodes GitHub knows as emoji and saves them as written', () => {
    const text = ':smile: and :+1:, not :nope: or :Smile:\n'
    const paragraph = markdownToDoc(text, schema).firstChild!
    const parts = [] as string[]
    paragraph.forEach((node) => parts.push(node.isText ? node.text! : `<${node.attrs['name']}>`))
    expect(parts).toEqual(['<smile>', ' and ', '<+1>', ', not :nope: or :Smile:'])
    expect(emojiOf('smile')).toBe('😄')
    expect(emojiOf('nope')).toBeNull()
    expect(emojiOf('constructor')).toBeNull()
    expect(roundTrip(text)).toBe(text)
  })

  it('leaves code alone', () => {
    const text = '`:smile:`\n\n```\n:smile:\n```\n'
    expect(nodesOf(markdownToDoc(text, schema), 'emoji')).toEqual([])
    expect(roundTrip(text)).toBe(text)
  })
})

describe('alerts', () => {
  it('finds the GitHub alerts and nothing else', () => {
    const text =
      '> [!NOTE]\n> Useful information.\n\n> [!WARNING]\n> Careful.\n\n' +
      '> [!note]-\n> Folded (Obsidian).\n\n> [!TIP] on one line\n\n> plain\n'
    const doc = markdownToDoc(text, schema)
    const alerts = findAlerts(doc)
    expect(alerts.map((alert) => alert.kind)).toEqual(['note', 'warning'])
    expect(alerts.map((alert) => doc.textBetween(alert.markerFrom, alert.markerTo))).toEqual([
      '[!NOTE]',
      '[!WARNING]'
    ])
    expect(doc.nodeAt(alerts[0].from)?.type.name).toBe('blockquote')
    expect(roundTrip(text)).toBe(text)
  })
})

describe('math', () => {
  it('opens inline formulas as math nodes, in both of GitHub`s forms', () => {
    const text = '$E = mc^2$ and $`E = mc^2`$\n'
    const formulas = nodesOf(markdownToDoc(text, schema), 'mathInline')
    expect(formulas.map(({ node }) => node.attrs['code'])).toEqual(['E = mc^2', '`E = mc^2`'])
    expect(mathSource('`E = mc^2`')).toBe('E = mc^2')
    expect(mathSource('E = mc^2')).toBe('E = mc^2')
    expect(roundTrip(text)).toBe(text)
  })

  it('keeps a $$ block and a math fence apart', () => {
    const text = '$$\nE = mc^2\n$$\n\n```math\nE = mc^2\n```\n'
    const blocks = nodesOf(markdownToDoc(text, schema), 'codeBlock')
    expect(blocks.map(({ node }) => [node.attrs['language'], node.attrs['fence']])).toEqual([
      ['math', 'dollar'],
      ['math', null]
    ])
    expect(roundTrip(text)).toBe(text)
  })

  it('escapes a typed dollar sign so it stays text', () => {
    const typed = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('Costs $5 and $10.'))
    ])
    expect(docToMarkdown(typed)).toBe('Costs \\$5 and \\$10.\n')
    expect(roundTrip('Costs \\$5 and \\$10.\n')).toBe('Costs \\$5 and \\$10.\n')
  })

  it('draws a formula with KaTeX and shows bad TeX rather than failing', async () => {
    expect(await renderMath('E = mc^2', false)).toContain('class="katex"')
    expect(await renderMath('\\frac{a}', true)).toContain('katex-error')
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
