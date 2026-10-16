import { Transform } from '@tiptap/pm/transform'
import prettier from 'prettier'
import type { Node as PmNode } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { stringWidth } from '../../src/renderer/markdown/mdast'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))

// Every Stage 1 row of docs/markdown-spec.md, in CoLeaf's own style.
const stage1 = `# Title

A paragraph with **bold**, _italic_, \`code\`, a [link](https://example.com "Title"), an
image ![alt](images/pic.png "Pic") and a [path](<my file.md>) and <https://example.com>.
Hard break next.\\
After the break, with \\*escaped\\* stars.
\\# A hash at the start of a line.

## Heading 2

> A quote
>
> > nested

- one
- two
  - nested
- three

3. third
4. fourth

\`\`\`js title="demo"
console.log(1)
\`\`\`

---

<div align="center">
  <b>html block</b>
</div>

Inline <span>html</span> too.
`

// Rows the editor does not edit yet: shown raw, saved unchanged, whatever their style.
const keptAsIs = `---
title: Front matter
---

| a | b |
| --- | --- |
| 1 | 2 |

- [ ] task
- [x] done

Strike ~~this~~, a footnote[^1], a [reference][ref], [collapsed][] and ![image ref][img].

[^1]: The note.

[ref]: https://example.com
[collapsed]: https://example.com/c
[img]: images/pic.png
`

describe('Markdown ⇄ editor document', () => {
  it('round-trips the Stage 1 rows byte for byte', () => {
    expect(roundTrip(stage1)).toBe(stage1)
  })

  it('keeps every kept-as-is row unchanged', () => {
    expect(roundTrip(keptAsIs)).toBe(keptAsIs)
  })

  it('is stable: a second pass changes nothing', () => {
    const once = roundTrip(stage1 + '\n' + keptAsIs)
    expect(roundTrip(once)).toBe(once)
  })

  it('keeps the wrapping of a paragraph as soft breaks', () => {
    const doc = markdownToDoc('one\ntwo\n  three\n', schema)
    const paragraph = doc.firstChild
    expect(paragraph?.childCount).toBe(5)
    expect(paragraph?.child(1).type.name).toBe('softBreak')
    expect(paragraph?.child(4).text).toBe('three')
    expect(docToMarkdown(doc)).toBe('one\ntwo\nthree\n')
  })

  it('keeps tight and loose lists apart', () => {
    const loose = '- one\n\n- two\n'
    const tight = '- one\n- two\n'
    expect(roundTrip(loose)).toBe(loose)
    expect(roundTrip(tight)).toBe(tight)
  })

  it('normalizes alternate syntax to the house style', () => {
    // Two lists with different bullets stay two lists: the second gets the other bullet.
    expect(roundTrip('Title\n=====\n\n* item\n+ item\n\n__bold__ and *em*\n\n***\n')).toBe(
      '# Title\n\n- item\n\n* item\n\n**bold** and _em_\n\n---\n'
    )
  })

  it('gives a nested task list the house bullet', () => {
    expect(roundTrip('- item\n  * [x] done\n')).toBe('- item\n  - [x] done\n')
  })

  it('keeps links as the file wrote them', () => {
    const text =
      'See [`code`](https://x.y/a?b=1&c=2), [https://x.y](https://x.y), <https://x.y> and [**bold**](https://x.y).\n'
    expect(roundTrip(text)).toBe(text)
  })

  it('tells front matter from a file that merely starts with a rule', () => {
    expect(roundTrip('---\n\n> a\n\n- item\n')).toBe('---\n\n> a\n\n- item\n')
    expect(markdownToDoc('---\n\n> a\n', schema).child(1).type.name).toBe('blockquote')
    const withFrontMatter = markdownToDoc('---\ntitle: x\n---\n\n# Title\n', schema)
    expect(withFrontMatter.firstChild?.type.name).toBe('rawBlock')
    expect(withFrontMatter.firstChild?.attrs['source']).toBe('---\ntitle: x\n---')
    expect(roundTrip('+++\ntitle = "x"\n+++\n\ntext\n')).toBe('+++\ntitle = "x"\n+++\n\ntext\n')
  })

  it('writes an item loose when a nested list starting past 1 follows its paragraph', () => {
    const { nodes } = schema
    const nested = nodes.orderedList.create({ start: 2 }, [
      nodes.listItem.create(null, nodes.paragraph.create(null, schema.text('b')))
    ])
    const doc = nodes.doc.create(null, [
      nodes.bulletList.create(null, [
        nodes.listItem.create(null, [nodes.paragraph.create(null, schema.text('a')), nested])
      ])
    ])
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('- a\n\n  2. b\n')
    expect(markdownToDoc(markdown, schema).firstChild?.firstChild?.childCount).toBe(2)
  })

  it('escapes what a user could type as Markdown', () => {
    const doc = markdownToDoc('plain\n', schema)
    const typed = schema.nodes.paragraph.create(null, schema.text('# not a heading *nor* em'))
    const edited = doc.type.create(null, [typed])
    expect(docToMarkdown(edited)).toBe('\\# not a heading \\*nor\\* em\n')
  })

  it('opens an empty file as one empty paragraph and saves it empty again', () => {
    for (const text of ['', '\n', '\n\n']) {
      const doc = markdownToDoc(text, schema)
      expect(doc.childCount).toBe(1)
      expect(doc.firstChild?.type.name).toBe('paragraph')
      expect(doc.firstChild?.childCount).toBe(0)
      expect(docToMarkdown(doc)).toBe('')
    }
  })
})

describe('tables', () => {
  const { nodes } = schema
  const prettierOptions = {
    parser: 'markdown',
    proseWrap: 'preserve',
    embeddedLanguageFormatting: 'off'
  } as const
  const unpadded = '| a | b |\n| --- | --- |\n| 1 | 2 |\n'
  const aligned = '| left | center | right |\n| :--- | :----: | ----: |\n| 1 | 2 | 3 |\n'

  // Types `text` at the end of the cell holding `cell`.
  function typeInto(markdown: string, cell: string, text: string): string {
    const doc = markdownToDoc(markdown, schema)
    let at = -1
    doc.descendants((node, pos) => {
      if (node.isText && node.text === cell) at = pos + cell.length
    })
    expect(at).toBeGreaterThan(0)
    return docToMarkdown(new Transform(doc).replaceWith(at, at, schema.text(text)).doc)
  }

  it('opens a table as a header row and cells, each column aligned as the file says', () => {
    const table = markdownToDoc(aligned, schema).firstChild!
    expect(table.type.name).toBe('table')
    expect(table.childCount).toBe(2)
    const header = table.firstChild!
    expect(header.child(0).type.name).toBe('tableHeader')
    expect([0, 1, 2].map((i) => header.child(i).attrs['align'])).toEqual([
      'left',
      'center',
      'right'
    ])
    const body = table.child(1)
    expect(body.child(0).type.name).toBe('tableCell')
    expect(body.child(0).firstChild?.type.name).toBe('paragraph')
    expect(body.child(0).textContent).toBe('1')
  })

  it('writes an untouched table back byte for byte, whatever its layout', () => {
    expect(roundTrip(unpadded)).toBe(unpadded)
    expect(roundTrip('|a|b|\n|-|-|\n|1|2|\n')).toBe('|a|b|\n|-|-|\n|1|2|\n')
    expect(roundTrip('# T\n\n| a |\n| --- |\n\nAfter\n')).toBe('# T\n\n| a |\n| --- |\n\nAfter\n')
  })

  it("writes an edited table in Prettier's layout, pipes escaped", async () => {
    const markdown = typeInto(unpadded, '2', 'typed |')
    expect(markdown).toBe('| a   | b         |\n| --- | --------- |\n| 1   | 2typed \\| |\n')
    expect(await prettier.format(markdown, prettierOptions)).toBe(markdown)
    expect(roundTrip(markdown)).toBe(markdown)
    expect(markdownToDoc(markdown, schema).textContent).toBe('ab12typed |')
  })

  it('keeps the alignment and aligns the text like Prettier when edited', async () => {
    const markdown = typeInto(aligned, '1', 'x')
    expect(markdown).toBe(
      '| left | center | right |\n| :--- | :----: | ----: |\n| 1x   |   2    |     3 |\n'
    )
    expect(await prettier.format(markdown, prettierOptions)).toBe(markdown)
  })

  it('restores the source once an edit is undone', () => {
    const doc = markdownToDoc(unpadded, schema)
    const edited = new Transform(doc).replaceWith(4, 4, schema.text('x')).doc // "xa"
    expect(docToMarkdown(edited)).not.toBe(unpadded)
    const undone = new Transform(edited).delete(4, 5).doc
    expect(docToMarkdown(undone)).toBe(unpadded)
  })

  it('writes a line break in a cell as <br>', () => {
    const cell = (content: PmNode | PmNode[]): PmNode => nodes.paragraph.create(null, content)
    const doc = nodes.doc.create(null, [
      nodes.table.create(null, [
        nodes.tableRow.create(null, [nodes.tableHeader.create(null, cell(schema.text('h')))]),
        nodes.tableRow.create(null, [
          nodes.tableCell.create(
            null,
            cell([schema.text('a'), nodes.hardBreak.create(), schema.text('b')])
          )
        ])
      ])
    ])
    const markdown = docToMarkdown(doc)
    expect(markdown).toBe('| h      |\n| ------ |\n| a<br>b |\n')
    expect(roundTrip(markdown)).toBe(markdown)
  })

  it('edits a table inside a list item too', () => {
    const nested = '- item\n\n  | a |\n  | - |\n  | 1 |\n'
    const saved = roundTrip(nested)
    expect(saved).toBe('- item\n\n  | a   |\n  | --- |\n  | 1   |\n')
    expect(roundTrip(saved)).toBe(saved)
  })

  it('pads wide characters as two columns, like Prettier', async () => {
    expect(stringWidth('abc')).toBe(3)
    expect(stringWidth('名前')).toBe(4)
    expect(stringWidth('é')).toBe(1)
    const markdown = typeInto('| 名前 | b |\n| --- | --- |\n| 1 | 2 |\n', '2', 'x')
    expect(markdown).toBe('| 名前 | b   |\n| ---- | --- |\n| 1    | 2x  |\n')
    expect(await prettier.format(markdown, prettierOptions)).toBe(markdown)
  })
})
