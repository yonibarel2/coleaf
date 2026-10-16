import { Transform } from '@tiptap/pm/transform'
import fc from 'fast-check'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Mark, Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

// Random documents built from the Stage 1 rows, and random edits on the golden files: whatever
// a user writes, saving and reopening must give the same document, and saving must be stable.

const { nodes, marks } = schema

// Words from letters, digits and every punctuation mark Markdown gives a meaning to, except `@`:
// GitHub turns a typed email into a link whatever the escaping, and so does a reopen.
const alphabet = 'abcXYZ019' + '*_#>[]()<>`~|$&%+=\\{}-.!:;,?\'"/'
const word = fc
  .array(fc.constantFrom(...alphabet), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''))
const line = fc.array(word, { minLength: 1, maxLength: 6 }).map((words) => words.join(' '))
const codeText = fc.stringMatching(/^[a-z0-9][a-z0-9 ]{0,8}[a-z0-9]$/)

const inlineMarks = fc
  .subarray(['bold', 'italic'])
  .map((names) => names.map((name) => marks[name].create()))
const textRun = fc
  .record({ text: line, marks: inlineMarks })
  .map(({ text, marks }) => schema.text(text, marks))
const codeRun = codeText.map((text) => schema.text(text, [marks.code.create()]))
const linkRun = fc
  .record({ text: line, path: fc.stringMatching(/^[a-z]{1,6}$/) })
  .map(({ text, path }) =>
    // `form: 'resource'`, as a reopened `[text](url)` link has it.
    schema.text(text, [
      marks.link.create({ href: `https://example.com/${path}`, form: 'resource' })
    ])
  )
const inline = fc.array(fc.oneof(textRun, textRun, codeRun, linkRun), {
  minLength: 1,
  maxLength: 4
})
const paragraph = inline.map((content) => nodes.paragraph.create(null, content))
const heading = fc
  .record({ level: fc.integer({ min: 1, max: 6 }), content: inline })
  .map(({ level, content }) => nodes.heading.create({ level }, content))
const codeBlock = fc
  .record({
    language: fc.option(fc.stringMatching(/^[a-z]{1,5}$/), { nil: null }),
    lines: fc.array(codeText, { maxLength: 3 })
  })
  .map(({ language, lines }) =>
    nodes.codeBlock.create({ language }, lines.length ? schema.text(lines.join('\n')) : undefined)
  )
const rule = fc.constant(nodes.horizontalRule.create())

const block: fc.Arbitrary<PmNode> = fc.letrec<{ block: PmNode; list: PmNode; item: PmNode }>(
  (tie) => ({
    block: fc.oneof(
      { depthSize: 'small' },
      paragraph,
      paragraph,
      heading,
      codeBlock,
      rule,
      tie('list'),
      fc
        .array(tie('block'), { minLength: 1, maxLength: 2 })
        .map((blocks) => nodes.blockquote.create(null, blocks))
    ),
    item: fc
      .record({ text: paragraph, nested: fc.option(tie('list'), { nil: null }) })
      .map(({ text, nested }) => nodes.listItem.create(null, nested ? [text, nested] : [text])),
    // Nested lists start at 1: a list starting elsewhere after a paragraph is written loose
    // (see bridge.test.ts), which is a different document.
    list: fc
      .record({
        ordered: fc.boolean(),
        items: fc.array(tie('item'), { minLength: 1, maxLength: 3 })
      })
      .map(({ ordered, items }) =>
        ordered ? nodes.orderedList.create(null, items) : nodes.bulletList.create(null, items)
      )
  })
).block

// A document never starts with a rule: `---` at the top followed by another `---` line is front
// matter to GitHub, Prettier and remark alike, so that shape cannot round-trip anywhere.
const document = fc
  .array(block, { minLength: 1, maxLength: 5 })
  .filter((blocks) => blocks[0].type.name !== 'horizontalRule')
  .map((blocks) => nodes.doc.create(null, blocks))

// Deterministic by default; set FC_SEED to explore (a failure prints the seed to reproduce).
fc.configureGlobal({ seed: Number(process.env['FC_SEED'] ?? 20261016) })

describe('properties', () => {
  it('any Stage 1 document survives save and reopen', () => {
    fc.assert(
      fc.property(document, (doc) => {
        const markdown = docToMarkdown(doc)
        const reopened = markdownToDoc(markdown, schema)
        expect(reopened.eq(doc), `${markdown}\n→ ${JSON.stringify(reopened.toJSON())}`).toBe(true)
      }),
      { numRuns: 200 }
    )
  }, 60_000)

  const goldenDir = resolve('tests', 'roundtrip')
  const golden = ['blocks', 'inline'].flatMap((section) =>
    readdirSync(join(goldenDir, section)).map((file) => `${section}/${file}`)
  )

  // One random edit: insert a word into a text node, delete part of one, or toggle bold on it.
  const edit = fc.record({
    target: fc.nat(),
    kind: fc.constantFrom('insert', 'delete', 'bold'),
    text: word,
    at: fc.nat()
  })

  function textSpans(doc: PmNode): { from: number; to: number }[] {
    const spans: { from: number; to: number }[] = []
    doc.descendants((node, pos) => {
      if (node.isText && !node.marks.some((mark: Mark) => mark.type.name === 'rawMark')) {
        spans.push({ from: pos, to: pos + node.nodeSize })
      }
    })
    return spans
  }

  for (const file of golden) {
    it(`random edits on ${file} save stably`, () => {
      const original = markdownToDoc(readFileSync(join(goldenDir, file), 'utf8'), schema)
      fc.assert(
        fc.property(fc.array(edit, { minLength: 1, maxLength: 3 }), (edits) => {
          let doc = original
          for (const { target, kind, text, at } of edits) {
            const spans = textSpans(doc)
            if (spans.length === 0) return
            const { from, to } = spans[target % spans.length]
            const position = from + (at % (to - from + 1))
            const tr = new Transform(doc)
            if (kind === 'insert') tr.replaceWith(position, position, schema.text(text))
            else if (kind === 'delete' && to - from > 1) tr.delete(from, from + 1)
            else tr.addMark(from, to, marks.bold.create())
            doc = tr.doc
          }
          const markdown = docToMarkdown(doc)
          const reopened = markdownToDoc(markdown, schema)
          expect(docToMarkdown(reopened), markdown).toBe(markdown)
          expect(reopened.textContent.replace(/\s/g, '')).toBe(doc.textContent.replace(/\s/g, ''))
        }),
        { numRuns: 25 }
      )
    }, 60_000)
  }
})
