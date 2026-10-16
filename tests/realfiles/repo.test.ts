import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeDocument, encodeDocument } from '../../src/main/files/document'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'
import { needsSave } from '../../src/renderer/tabs/saveRule'

// The repo's own Markdown through the real open → save path: nothing may change.

const root = resolve('.')
const skipped = new Set(['node_modules', 'out', '.git', 'roundtrip'])

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skipped.has(entry.name)) return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return /\.(md|markdown)$/i.test(entry.name) ? [path] : []
  })
}

const files = markdownFiles(root).map((file) => relative(root, file).split(sep).join('/'))
// The owner's docs are written in Prettier's style and must come back byte for byte.
const ours = files.filter((file) => /^(README\.md|AGENTS\.md|docs\/[^/]+\.md)$/.test(file))

describe('repo files', () => {
  it('finds the docs', () => {
    expect(ours).toEqual(expect.arrayContaining(['README.md', 'AGENTS.md', 'docs/plan.md']))
  })

  for (const file of files) {
    it(`opens ${file} and never writes it untouched`, () => {
      const document = decodeDocument(readFileSync(join(root, file)))
      const doc = markdownToDoc(document.text, schema)
      expect(needsSave(doc, doc)).toBe(false)
      expect(encodeDocument(document.text, document)).toBe(readFileSync(join(root, file), 'utf8'))
    })
  }

  for (const file of ours) {
    it(`saves ${file} byte for byte after an edit is undone`, () => {
      const document = decodeDocument(readFileSync(join(root, file)))
      const doc = markdownToDoc(document.text, schema)
      expect(docToMarkdown(doc)).toBe(document.text)
    })
  }
})
