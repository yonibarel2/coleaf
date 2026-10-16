import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeDocument } from '../../src/main/files/document'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { docToMarkdown } from '../../src/renderer/markdown/toMarkdown'
import { needsSave } from '../../src/renderer/tabs/saveRule'

// Every README in node_modules, as a corpus of Markdown written by other people and tools.
// Opening must never fail and an untouched file is never written; how many would survive an
// edit byte for byte is reported, not required (that is Stage 5).

const modules = resolve('node_modules')

function readmes(): string[] {
  if (!existsSync(modules)) return []
  const found: string[] = []
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dirs = entry.name.startsWith('@')
      ? readdirSync(join(modules, entry.name), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => join(modules, entry.name, e.name))
      : [join(modules, entry.name)]
    for (const dir of dirs) {
      const readme = readdirSync(dir).find((name) => /^readme\.(md|markdown)$/i.test(name))
      if (readme) found.push(join(dir, readme))
    }
  }
  return found
}

// The first line that differs, to show what kind of change it is.
function firstDifference(a: string, b: string): string {
  const left = a.split('\n')
  const right = b.split('\n')
  const index = left.findIndex((line, i) => line !== right[i])
  return index < 0
    ? ''
    : `line ${index + 1}: ${JSON.stringify(left[index])} → ${JSON.stringify(right[index] ?? '')}`
}

describe('node_modules READMEs', () => {
  const files = readmes()

  it.skipIf(files.length === 0)(
    'all open, none is written untouched',
    () => {
      const identical: string[] = []
      const changed: string[] = []
      for (const file of files) {
        const document = decodeDocument(readFileSync(file))
        const doc = markdownToDoc(document.text, schema)
        expect(needsSave(doc, doc)).toBe(false)
        const saved = docToMarkdown(doc)
        if (saved === document.text) identical.push(file)
        else
          changed.push(
            `${file.slice(modules.length + 1)}: ${firstDifference(document.text, saved)}`
          )
      }
      const rate = Math.round((identical.length / files.length) * 100)
      const report = [
        `${files.length} READMEs opened; ${identical.length} (${rate}%) would be saved byte for byte.`,
        ...changed.slice(0, 15).map((line) => `  ${line}`),
        changed.length > 15 ? `  … and ${changed.length - 15} more` : ''
      ].join('\n')
      process.stderr.write(`${report}\n`)
      expect(files.length).toBeGreaterThan(0)
    },
    120_000
  )
})
