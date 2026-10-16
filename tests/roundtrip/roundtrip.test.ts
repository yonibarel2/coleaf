import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import prettier from 'prettier'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'

// Golden files: one per row of docs/markdown-spec.md, in the form CoLeaf saves. Opening and
// saving one must not change a byte. Alternate spellings live in normalize/ as .in.md → .out.md.

const root = resolve('tests', 'roundtrip')
const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown, schema))
const read = (file: string): string => readFileSync(file, 'utf8')
const name = (file: string): string => relative(root, file).split(sep).join('/')

const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => join(entry.parentPath, entry.name))
const golden = files.filter((file) => !name(file).startsWith('normalize/'))

// Rows that cannot survive mdast yet; the untouched rule still protects them (Stage 5 work).
const knownGaps = new Map([
  ['inline/16-html-entity.md', 'entities are decoded by the parser'],
  ['extras/03b-math-dollar-escape.md', 'needs remark-math to tell \\$ from $math$'],
  ['other/09-admonition.md', 'indentation inside a paragraph is not kept']
])

// Stage 1 rows (the CommonMark sections and GFM tables) must also be exactly what Prettier
// would write (AGENTS.md rule 1).
const stage1 = (file: string): boolean => /^(blocks|inline)\/|^gfm\/0[1-3]-/.test(name(file))
const prettierOptions = {
  parser: 'markdown',
  proseWrap: 'preserve',
  embeddedLanguageFormatting: 'off'
} as const

describe('round trip: open + save changes nothing', () => {
  for (const file of golden) {
    const gap = knownGaps.get(name(file))
    const test = gap ? it.fails : it
    test(`${name(file)}${gap ? ` (known gap: ${gap})` : ''}`, () => {
      const text = read(file)
      expect(roundTrip(text)).toBe(text)
    })
  }
})

describe('Prettier agrees with the Stage 1 rows', () => {
  for (const file of golden.filter((f) => stage1(f) && !knownGaps.has(name(f)))) {
    it(name(file), async () => {
      const text = read(file)
      expect(await prettier.format(text, prettierOptions)).toBe(text)
    })
  }
})

describe('alternate syntax is saved in the house style', () => {
  const inputs = files.filter((f) => name(f).startsWith('normalize/') && f.endsWith('.in.md'))
  for (const input of inputs) {
    it(name(input).replace('.in.md', ''), () => {
      expect(roundTrip(read(input))).toBe(read(input.replace(/\.in\.md$/, '.out.md')))
    })
  }
})
