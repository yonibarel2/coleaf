import { BrowserWindow, ipcMain } from 'electron'
import { channels } from '../../preload/contract'
import type { ProjectSession } from '../files/session'
import { settleUnsaved } from './app'

/** Wires the project messages of the preload allowlist to the session. */
export function registerProjectIpc(session: ProjectSession): void {
  ipcMain.handle(channels.projectOpen, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    if (!(await settleUnsaved(window))) return session.current
    return session.open(window)
  })
  ipcMain.handle(channels.projectClose, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    if (await settleUnsaved(window)) session.close()
  })
  ipcMain.handle(channels.projectCurrent, () => session.current)
  ipcMain.handle(channels.projectListDir, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('Expected a path')
    return session.listDir(path)
  })
}
