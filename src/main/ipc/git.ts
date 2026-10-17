import { ipcMain } from 'electron'
import { channels, type ConflictChoice, type GitIdentity } from '../../preload/contract'
import type { ProjectSession } from '../files/session'

const choices: ConflictChoice[] = ['mine', 'theirs', 'both']

function isIdentity(value: unknown): value is GitIdentity {
  if (typeof value !== 'object' || value === null) return false
  const identity = value as Record<string, unknown>
  return typeof identity['name'] === 'string' && typeof identity['email'] === 'string'
}

function isPaths(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((path) => typeof path === 'string')
}

function isChoices(value: unknown): value is ConflictChoice[] {
  return Array.isArray(value) && value.every((choice) => choices.includes(choice))
}

function isSide(value: unknown): value is 'mine' | 'theirs' {
  return value === 'mine' || value === 'theirs'
}

function path(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a path')
  return value
}

/**
 * Wires the Git messages of the preload allowlist to the session's tracker. `token` gives the
 * signed-in user's GitHub token, which only ever goes to Git for a github.com remote.
 */
export function registerGitIpc(session: ProjectSession, token: () => string | null): void {
  const git = session.git
  ipcMain.handle(channels.gitStatus, () => git.refresh())
  ipcMain.handle(channels.gitCommit, (_event, paths: unknown, message: unknown) => {
    if (!isPaths(paths) || typeof message !== 'string')
      throw new Error('Expected paths and a message')
    return git.commit(paths, message)
  })
  ipcMain.handle(channels.gitIdentity, () => git.identity())
  ipcMain.handle(channels.gitSetIdentity, (_event, identity: unknown) => {
    if (!isIdentity(identity)) throw new Error('Expected a name and an email')
    return git.setIdentity(identity)
  })
  ipcMain.handle(channels.gitSync, (_event, paths: unknown, message: unknown) => {
    if (!isPaths(paths) || typeof message !== 'string')
      throw new Error('Expected paths and a message')
    return git.sync(paths, message, token())
  })
  ipcMain.handle(channels.gitSyncFinish, () => git.finishSync(token()))
  ipcMain.handle(channels.gitSyncCancel, () => git.cancelSync())
  ipcMain.handle(channels.gitConflictRead, (_event, value: unknown) =>
    git.readConflict(path(value))
  )
  ipcMain.handle(channels.gitConflictResolve, (_event, value: unknown, chosen: unknown) => {
    if (!isChoices(chosen)) throw new Error('Expected a choice per conflict')
    return git.resolveConflict(path(value), chosen)
  })
  ipcMain.handle(channels.gitConflictFile, (_event, value: unknown, side: unknown) => {
    if (!isSide(side)) throw new Error('Expected mine or theirs')
    return git.resolveFile(path(value), side)
  })
}
