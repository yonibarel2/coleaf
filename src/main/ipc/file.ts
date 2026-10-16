import { BrowserWindow, dialog, ipcMain } from 'electron'
import { channels, type SaveChoice } from '../../preload/contract'
import { readDocument, writeDocument } from '../files/document'
import type { ProjectSession } from '../files/session'

const saveChoices: SaveChoice[] = ['save', 'discard', 'cancel']

/** Wires the file and dialog messages of the preload allowlist. */
export function registerFileIpc(session: ProjectSession): void {
  const root = (): string => {
    if (!session.current) throw new Error('No project is open')
    return session.current.root
  }

  ipcMain.handle(channels.fileRead, (_event, path: unknown) => {
    if (typeof path !== 'string') throw new Error('Expected a path')
    return readDocument(root(), path)
  })

  ipcMain.handle(channels.fileWrite, (_event, path: unknown, text: unknown) => {
    if (typeof path !== 'string' || typeof text !== 'string')
      throw new Error('Expected a path and text')
    return writeDocument(root(), path, text)
  })

  ipcMain.handle(channels.dialogAskSave, async (event, name: unknown): Promise<SaveChoice> => {
    const options = {
      type: 'question' as const,
      buttons: ['Save', "Don't save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Save changes to ${typeof name === 'string' ? name : 'this file'}?`,
      detail: "Your changes will be lost if you don't save them."
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const { response } = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)
    return saveChoices[response] ?? 'cancel'
  })
}
