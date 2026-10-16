import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
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

  it('keeps a nested kept-as-is block by re-writing its mdast', () => {
    const nested = '- item\n\n  | a | b |\n  | --- | --- |\n  | 1 | 2 |\n'
    expect(roundTrip(nested)).toBe('- item\n\n  | a | b |\n  | - | - |\n  | 1 | 2 |\n')
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
})
