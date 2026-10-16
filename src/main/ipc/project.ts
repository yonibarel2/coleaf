import { BrowserWindow, ipcMain } from 'electron'
import { channels } from '../../preload/contract'
import type { ProjectSession } from '../files/session'

/** Wires the project messages of the preload allowlist to the session. */
export function registerProjectIpc(session: ProjectSession): void {
  ipcMain.handle(channels.projectOpen, (event) =>
    session.open(BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )
  ipcMain.handle(channels.projectClose, () => session.close())
  ipcMain.handle(channels.projectCurrent, () => session.current)
  ipcMain.handle(channels.projectListDir, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('Expected a path')
    return session.listDir(path)
  })
}
