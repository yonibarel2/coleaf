import { relative, resolve } from 'node:path'
import type { ChangedFile, ChangeKind, GitIdentity, GitStatus } from '../../preload/contract'
import { git } from './run'

const notARepo: GitStatus = { repo: false, branch: null, changes: [] }

// Windows and macOS file systems ignore letter case; Linux does not.
const ignoresCase = process.platform === 'win32' || process.platform === 'darwin'

/**
 * The branch and the changed files of the project, as `git status` reports them. A project
 * folder inside a larger repository sees only its own files.
 */
export async function status(root: string): Promise<GitStatus> {
  const top = await topLevel(root)
  if (top === null) return notARepo
  const output = await git(root, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
    '-z',
    '--',
    '.'
  ])
  const prefix = treePath(relative(top, resolve(root)))
  const { branch, changes } = parseStatus(output)
  return {
    repo: true,
    branch,
    changes: changes
      .map((change) => ({
        ...change,
        path: stripPrefix(change.path, prefix),
        ...(change.from ? { from: stripPrefix(change.from, prefix) } : {})
      }))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
  }
}

/** The root folder of the repository the folder is in, or `null` outside any repository. */
async function topLevel(root: string): Promise<string | null> {
  try {
    const output = await git(root, ['rev-parse', '--show-toplevel'])
    return resolve(output.trim())
  } catch {
    return null
  }
}

/**
 * Reads `git status --porcelain=v2 -z --branch`: NUL-separated records, header lines first.
 * Index and working tree are shown as one: what changed since the last version, whatever Git's
 * staging area says.
 */
export function parseStatus(output: string): { branch: string | null; changes: ChangedFile[] } {
  const records = output.split('\0')
  let branch: string | null = null
  const changes: ChangedFile[] = []
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (record === '') continue
    if (record.startsWith('# ')) {
      const [key, ...rest] = record.slice(2).split(' ')
      if (key === 'branch.head') branch = rest.join(' ')
      continue
    }
    const type = record[0]
    if (type === '?') {
      changes.push({ path: record.slice(2), kind: 'new' })
    } else if (type === '1') {
      const fields = record.split(' ')
      changes.push({ path: fields.slice(8).join(' '), kind: kindOf(fields[1]) })
    } else if (type === '2') {
      // A rename: the new path ends the record, the old one is the next record.
      const fields = record.split(' ')
      const from = records[++index] ?? ''
      const path = fields.slice(9).join(' ')
      changes.push({ path, kind: fields[1].includes('D') ? 'deleted' : 'renamed', from })
    } else if (type === 'u') {
      const fields = record.split(' ')
      changes.push({ path: fields.slice(10).join(' '), kind: 'conflict' })
    }
  }
  return { branch, changes }
}

// XY: the index and the working tree side of a change. A deletion on either side wins.
function kindOf(xy: string): ChangeKind {
  if (xy.includes('D')) return 'deleted'
  if (xy[0] === 'A') return 'new'
  return 'modified'
}

function treePath(path: string): string {
  return path.split('\\').join('/')
}

// The project's place inside the repository, taken off the paths Git reports.
function stripPrefix(path: string, prefix: string): string {
  if (prefix === '' || prefix === '.') return path
  const head = `${prefix}/`
  const matches = ignoresCase
    ? path.toLowerCase().startsWith(head.toLowerCase())
    : path.startsWith(head)
  return matches ? path.slice(head.length) : path
}

/**
 * Saves a version with the given files only (new and deleted ones included), whatever else is
 * staged. The message is required.
 */
export async function commit(root: string, paths: string[], message: string): Promise<void> {
  if (paths.length === 0) throw new Error('Tick at least one file')
  if (message.trim() === '') throw new Error('A message is required')
  const pathspecs = paths.map((path) => `:(literal)${path}`)
  await git(root, ['add', '--all', '--', ...pathspecs])
  await git(root, ['commit', '--quiet', '--file=-', '--', ...pathspecs], { stdin: message })
}

/** The name and email Git would put on a version saved in this folder; empty when unset. */
export async function identity(root: string): Promise<GitIdentity> {
  const read = async (key: string): Promise<string> =>
    (await git(root, ['config', '--get', key], { ok: [1] })).trim()
  return { name: await read('user.name'), email: await read('user.email') }
}

/** Saves the name and email for every repository on this computer. */
export async function setIdentity(root: string, { name, email }: GitIdentity): Promise<void> {
  if (name.trim() === '' || email.trim() === '') throw new Error('Name and email are required')
  await git(root, ['config', '--global', 'user.name', name.trim()])
  await git(root, ['config', '--global', 'user.email', email.trim()])
}
