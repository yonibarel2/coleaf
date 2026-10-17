import { readFile } from 'node:fs/promises'
import type { ConflictChoice, ConflictPart } from '../../preload/contract'
import { decodeDocument, writeDocument } from '../files/document'
import { resolveInside } from '../files/project'
import { git } from './run'

// Git's markers, one per line: ours, (base, in the diff3 style), the divider, theirs.
const mineMarker = /^<{7}(?: |$)/
const baseMarker = /^\|{7}(?: |$)/
const divider = /^={7}$/
const theirsMarker = /^>{7}(?: |$)/

/**
 * Splits text with Git's conflict markers into parts: text both versions share, and for each
 * conflict the two versions. Line endings are `\n`; every line keeps its newline, so joining
 * the parts gives the text back. A diff3 base section is dropped.
 */
export function splitConflicts(text: string): ConflictPart[] {
  const lines = text.split('\n')
  const last = lines.length - 1
  const parts: ConflictPart[] = []
  let state: 'same' | 'mine' | 'base' | 'theirs' = 'same'
  let same = ''
  let mine = ''
  let theirs = ''
  const flushSame = (): void => {
    if (same !== '') parts.push({ kind: 'same', text: same })
    same = ''
  }
  lines.forEach((line, index) => {
    const withNewline = index < last ? `${line}\n` : line
    if (state === 'same') {
      if (mineMarker.test(line)) {
        flushSame()
        state = 'mine'
        mine = ''
        theirs = ''
      } else same += withNewline
    } else if (state === 'mine') {
      if (divider.test(line)) state = 'theirs'
      else if (baseMarker.test(line)) state = 'base'
      else mine += withNewline
    } else if (state === 'base') {
      if (divider.test(line)) state = 'theirs'
    } else if (theirsMarker.test(line)) {
      parts.push({ kind: 'conflict', mine, theirs })
      state = 'same'
    } else theirs += withNewline
  })
  if (state !== 'same') {
    // Markers never closed: keep what was read as a conflict rather than lose it.
    parts.push({ kind: 'conflict', mine, theirs })
  } else flushSame()
  return parts
}

/** The text with every conflict replaced by the chosen version(s), in order. */
export function joinParts(parts: ConflictPart[], choices: ConflictChoice[]): string {
  const conflicts = parts.filter((part) => part.kind === 'conflict').length
  if (choices.length !== conflicts) {
    throw new Error(`Expected ${conflicts} choices, got ${choices.length}`)
  }
  let index = 0
  return parts
    .map((part) => {
      if (part.kind === 'same') return part.text
      const choice = choices[index++]
      if (choice === 'mine') return part.mine
      if (choice === 'theirs') return part.theirs
      return part.mine + part.theirs
    })
    .join('')
}

/** The parts of a conflicted text file of the project. */
export async function readConflict(root: string, path: string): Promise<ConflictPart[]> {
  const document = decodeDocument(await readFile(await resolveInside(root, path)))
  if (document.readOnly) throw new Error(`Not a text file: ${path}`)
  return splitConflicts(document.text)
}

/**
 * Writes the user's choices into a conflicted Markdown file, in its original format, and
 * tells Git the conflict is settled.
 */
export async function resolveConflict(
  root: string,
  path: string,
  choices: ConflictChoice[]
): Promise<void> {
  const { text, readOnly, ...format } = decodeDocument(
    await readFile(await resolveInside(root, path))
  )
  if (readOnly) throw new Error(`Not a text file: ${path}`)
  await writeDocument(root, path, joinParts(splitConflicts(text), choices), format)
  await git(root, ['add', '--', `:(literal)${path}`])
}

/**
 * Settles a conflicted file as a whole with one side's version. A side that deleted the file
 * means the file goes.
 */
export async function resolveFile(
  root: string,
  path: string,
  side: 'mine' | 'theirs'
): Promise<void> {
  const pathspec = `:(literal)${path}`
  const stage = side === 'mine' ? '2' : '3'
  const entries = await git(root, ['ls-files', '--unmerged', '-z', '--', pathspec])
  const present = entries.split('\0').some((entry) => entry.split('\t')[0].split(' ')[2] === stage)
  if (present) {
    await git(root, ['checkout', side === 'mine' ? '--ours' : '--theirs', '--', pathspec])
    await git(root, ['add', '--', pathspec])
  } else {
    await git(root, ['rm', '--quiet', '--', pathspec])
  }
}
