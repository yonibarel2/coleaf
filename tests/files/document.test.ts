import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  decodeDocument,
  encodeDocument,
  readDocument,
  writeDocument
} from '../../src/main/files/document'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('decodeDocument', () => {
  it('reads plain UTF-8 with LF', () => {
    expect(decodeDocument(encode('# Hi\n\ntext\n'))).toEqual({
      text: '# Hi\n\ntext\n',
      eol: 'lf',
      bom: false,
      finalNewline: true,
      readOnly: false
    })
  })

  it('notes CRLF, a BOM and a missing final newline, and normalizes the text', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('# Hi\r\n\r\ntext')])
    expect(decodeDocument(bytes)).toEqual({
      text: '# Hi\n\ntext',
      eol: 'crlf',
      bom: true,
      finalNewline: false,
      readOnly: false
    })
  })

  it('opens a file that is not UTF-8 read-only', () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a]) // "café" in Latin-1
    const document = decodeDocument(latin1)
    expect(document.readOnly).toBe(true)
    expect(document.text).toMatch(/^caf/)
  })
})

describe('encodeDocument', () => {
  it('restores CRLF, the BOM and the final-newline state', () => {
    const format = { eol: 'crlf' as const, bom: true, finalNewline: false }
    expect(encodeDocument('# Hi\n\ntext\n', format)).toBe('﻿# Hi\r\n\r\ntext')
    expect(encodeDocument('# Hi\n\ntext', { eol: 'lf', bom: false, finalNewline: true })).toBe(
      '# Hi\n\ntext\n'
    )
  })

  it('round-trips every format through decode and encode', () => {
    for (const original of ['a\nb\n', 'a\r\nb\r\n', '﻿a\nb', 'a\r\nb']) {
      const document = decodeDocument(encode(original))
      expect(encodeDocument(document.text, document)).toBe(original)
    }
  })
})

describe('readDocument and writeDocument', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'coleaf-doc-'))
    await writeFile(join(root, 'crlf.md'), '﻿# Title\r\n\r\nLine\r\n')
    await writeFile(join(root, 'notes.txt'), 'not markdown')
  })

  afterAll(() => rm(root, { recursive: true, force: true }))

  it('writes back in the original format, replacing the file in one step', async () => {
    const document = await readDocument(root, 'crlf.md')
    expect(document).toMatchObject({ text: '# Title\n\nLine\n', eol: 'crlf', bom: true })
    await writeDocument(root, 'crlf.md', '# Title\n\nLine two\n', document)
    expect(await readFile(join(root, 'crlf.md'), 'utf8')).toBe('﻿# Title\r\n\r\nLine two\r\n')
  })

  it('refuses files that are not Markdown', async () => {
    await expect(readDocument(root, 'notes.txt')).rejects.toThrow(/Not a Markdown file/)
    await expect(
      writeDocument(root, 'notes.txt', 'x', { eol: 'lf', bom: false, finalNewline: true })
    ).rejects.toThrow(/Not a Markdown file/)
  })
})
