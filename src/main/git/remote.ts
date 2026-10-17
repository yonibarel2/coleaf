import type { SyncOutcome } from '../../preload/contract'
import { commit, isMerging, status } from './repo'
import { git, GitError } from './run'

export interface Remote {
  name: string
  url: string
  /** GitHub over HTTPS gets the signed-in user's token; SSH is not supported yet. */
  kind: 'github' | 'https' | 'ssh' | 'local'
}

/** The remote the branch shares with: its upstream's, else `origin`; null when there is none. */
export async function remoteInfo(root: string): Promise<Remote | null> {
  const names = (await git(root, ['remote'])).split(/\r?\n/).filter(Boolean)
  if (names.length === 0) return null
  const upstream = (
    await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
      ok: [128]
    })
  ).trim()
  const fromUpstream = names.find((name) => upstream.startsWith(`${name}/`))
  const name = fromUpstream ?? (names.includes('origin') ? 'origin' : names[0])
  const url = (await git(root, ['remote', 'get-url', name])).trim()
  return { name, url, kind: kindOfUrl(url) }
}

export function kindOfUrl(url: string): Remote['kind'] {
  if (/^(file:\/\/|[a-z]:[\\/]|[\\/.~])/i.test(url)) return 'local'
  if (/^https:\/\/(www\.)?github\.com\//i.test(url)) return 'github'
  if (/^https?:\/\//i.test(url)) return 'https'
  return 'ssh' // ssh://, git://, or scp-like user@host:path
}

/**
 * The signed-in user's token for a GitHub remote, as a header Git sends to github.com only.
 * It reaches Git through the environment of that one process, never the command line, and
 * never another host: the key is scoped to `https://github.com/`.
 */
export function authEnv(remote: Remote, token: string | null): Record<string, string> {
  if (remote.kind !== 'github' || !token) return {}
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`
  }
}

export interface SyncInput {
  /** The ticked files; none means "get the latest" only. */
  paths: string[]
  message: string
  token: string | null
}

/** Sync: a version with the ticked files, then others' changes in, then ours out. */
export async function sync(
  root: string,
  { paths, message, token }: SyncInput
): Promise<SyncOutcome> {
  if (paths.length > 0) await commit(root, paths, message)
  return share(root, token, false)
}

/** After every conflict got its choice: the merged version is saved and shared. */
export async function finishSync(root: string, token: string | null): Promise<SyncOutcome> {
  if (!(await isMerging(root))) {
    return { kind: 'error', pulled: false, message: 'No Sync is waiting to finish.' }
  }
  const unresolved = (await status(root)).changes.filter((change) => change.kind === 'conflict')
  if (unresolved.length > 0) {
    return { kind: 'conflicts', pulled: false, files: unresolved.map((change) => change.path) }
  }
  await git(root, ['commit', '--quiet', '--no-edit'])
  return share(root, token, true)
}

/** Drops the stopped Sync: the files go back to our version; the saved version stays. */
export async function cancelSync(root: string): Promise<void> {
  await git(root, ['merge', '--abort'])
}

// fetch → merge → push. Conflicts stop the merge for the user's choices (see conflicts.ts).
async function share(root: string, token: string | null, pulled: boolean): Promise<SyncOutcome> {
  const remote = await remoteInfo(root)
  if (!remote) return { kind: 'saved', pulled }
  if (remote.kind === 'ssh') return { kind: 'ssh', pulled }
  if (remote.kind === 'github' && !token) return { kind: 'sign-in', pulled }
  const env = authEnv(remote, token)
  const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (branch === 'HEAD') {
    return { kind: 'error', pulled, message: 'Not on a branch: Sync needs one.' }
  }
  try {
    await git(root, ['fetch', '--quiet', remote.name], { env })
  } catch (error) {
    return failure(error, pulled)
  }
  const ref = `refs/remotes/${remote.name}/${branch}`
  const remoteHead = (
    await git(root, ['rev-parse', '--verify', '--quiet', ref], { ok: [1] })
  ).trim()
  if (remoteHead !== '') {
    const before = (await git(root, ['rev-parse', 'HEAD'])).trim()
    try {
      // Two-way markers (mine / theirs) whatever the user's own conflict style.
      await git(root, ['-c', 'merge.conflictStyle=merge', 'merge', '--quiet', '--no-edit', ref])
    } catch (error) {
      if (await isMerging(root)) {
        const files = (await status(root)).changes
          .filter((change) => change.kind === 'conflict')
          .map((change) => change.path)
        return { kind: 'conflicts', pulled: true, files }
      }
      return failure(error, pulled)
    }
    const after = (await git(root, ['rev-parse', 'HEAD'])).trim()
    if (after !== before) pulled = true
    if (after === remoteHead) return { kind: 'synced', pulled, pushed: false } // nothing of ours
  }
  try {
    const refspec = `${branch}:${branch}`
    await git(root, ['push', '--quiet', '--set-upstream', remote.name, refspec], { env })
  } catch (error) {
    return failure(error, pulled)
  }
  return { kind: 'synced', pulled, pushed: true }
}

/** Sorts what Git said into an outcome the Sync view can explain. */
export function failure(error: unknown, pulled: boolean): SyncOutcome {
  if (!(error instanceof GitError)) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'error', pulled, message }
  }
  const text = error.stderr
  if (/would be overwritten by merge/i.test(text)) {
    const files = text
      .split(/\r?\n/)
      .filter((line) => /^\s+\S/.test(line))
      .map((line) => line.trim())
    const list = files.join(', ') || 'some files'
    const them = files.length === 1 ? 'it' : 'them'
    return {
      kind: 'error',
      pulled,
      message: `Others changed ${list}, which you edited but did not tick. Tick ${them} and Sync again.`
    }
  }
  if (
    /authentication failed|error: 40[13]|permission to .* denied|could not read username|write access to repository not granted|terminal prompts disabled/i.test(
      text
    )
  ) {
    return { kind: 'denied', pulled, message: error.message }
  }
  if (
    /could not resolve host|failed to connect|couldn't connect|connection timed out|network is unreachable|unable to access/i.test(
      text
    )
  ) {
    return { kind: 'offline', pulled, message: error.message }
  }
  if (/non-fast-forward|fetch first|\[rejected\]/i.test(text)) {
    return {
      kind: 'error',
      pulled,
      message: 'Someone shared changes while you were syncing. Sync again.'
    }
  }
  return { kind: 'error', pulled, message: error.message }
}
