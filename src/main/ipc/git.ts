import { ipcMain } from 'electron'
import { channels, type GitIdentity } from '../../preload/contract'
import type { ProjectSession } from '../files/session'

function isIdentity(value: unknown): value is GitIdentity {
  if (typeof value !== 'object' || value === null) return false
  const identity = value as Record<string, unknown>
  return typeof identity['name'] === 'string' && typeof identity['email'] === 'string'
}

/** Wires the Git messages of the preload allowlist to the session's tracker. */
export function registerGitIpc(session: ProjectSession): void {
  ipcMain.handle(channels.gitStatus, () => session.git.refresh())
  ipcMain.handle(channels.gitCommit, (_event, paths: unknown, message: unknown) => {
    const isPaths = Array.isArray(paths) && paths.every((path) => typeof path === 'string')
    if (!isPaths || typeof message !== 'string') throw new Error('Expected paths and a message')
    return session.git.commit(paths as string[], message)
  })
  ipcMain.handle(channels.gitIdentity, () => session.git.identity())
  ipcMain.handle(channels.gitSetIdentity, (_event, identity: unknown) => {
    if (!isIdentity(identity)) throw new Error('Expected a name and an email')
    return session.git.setIdentity(identity)
  })
}
