import { readFile, writeFile } from 'node:fs/promises'
import { isMarkdownName, resolveInside } from './project'

/** The text of a Markdown file of the project. Only `.md` and `.markdown` files are editable. */
export async function readDocument(root: string, path: string): Promise<string> {
  return readFile(await resolveDocument(root, path), 'utf8')
}

/** Writes a Markdown file of the project. The window only calls this for edited documents. */
export async function writeDocument(root: string, path: string, text: string): Promise<void> {
  await writeFile(await resolveDocument(root, path), text, 'utf8')
}

async function resolveDocument(root: string, path: string): Promise<string> {
  if (!isMarkdownName(path)) throw new Error(`Not a Markdown file: ${path}`)
  return resolveInside(root, path)
}
