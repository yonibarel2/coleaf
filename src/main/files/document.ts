import { readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { DocumentFormat, DocumentText } from '../../preload/contract'
import { isMarkdownName, resolveInside } from './project'

const bom = '﻿'

/** Decodes bytes the way a Markdown file is read: BOM, line endings and final newline noted. */
export function decodeDocument(bytes: Uint8Array): DocumentText {
  let text: string
  let readOnly = false
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    // Best effort, for display only.
    text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    readOnly = true
  }
  const hasBom = text.startsWith(bom)
  if (hasBom) text = text.slice(1)
  const crlf = text.includes('\r\n')
  if (crlf) text = text.replaceAll('\r\n', '\n')
  return {
    text,
    eol: crlf ? 'crlf' : 'lf',
    bom: hasBom,
    // An empty file (File › New File) gets the Prettier style, with a final newline, once edited.
    finalNewline: text === '' || text.endsWith('\n'),
    readOnly
  }
}

/** Encodes text for disk in the file's original format. */
export function encodeDocument(text: string, format: DocumentFormat): string {
  let out = text.replace(/\n+$/, '')
  if (format.finalNewline) out += '\n'
  if (format.eol === 'crlf') out = out.replaceAll('\n', '\r\n')
  return format.bom ? bom + out : out
}

/** Reads a Markdown file of the project. Only `.md` and `.markdown` files are editable. */
export async function readDocument(root: string, path: string): Promise<DocumentText> {
  return decodeDocument(await readFile(await resolveDocument(root, path)))
}

/**
 * Writes a Markdown file of the project in its original format. The file is replaced in one
 * step (written next to it, then renamed) so a crash can never leave it half-written.
 */
export async function writeDocument(
  root: string,
  path: string,
  text: string,
  format: DocumentFormat
): Promise<void> {
  const file = await resolveDocument(root, path)
  const temporary = `${file}.coleaf-saving`
  await writeFile(temporary, encodeDocument(text, format), 'utf8')
  await rename(temporary, file)
}

/**
 * Creates an empty Markdown file in the project. Never replaces a file: when one exists the
 * error has code `EEXIST`, and the caller can open that file instead.
 */
export async function createDocument(root: string, path: string): Promise<void> {
  if (!isMarkdownName(path)) throw new Error(`Not a Markdown file: ${path}`)
  const dir = await resolveInside(root, dirname(path))
  await writeFile(join(dir, basename(path)), '', { flag: 'wx' })
}

async function resolveDocument(root: string, path: string): Promise<string> {
  if (!isMarkdownName(path)) throw new Error(`Not a Markdown file: ${path}`)
  return resolveInside(root, path)
}
