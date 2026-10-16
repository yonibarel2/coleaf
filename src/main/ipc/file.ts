import { BrowserWindow, dialog, ipcMain } from 'electron'
import { channels, type DocumentFormat, type SaveChoice } from '../../preload/contract'
import { readDocument, writeDocument } from '../files/document'
import type { ProjectSession } from '../files/session'

const saveChoices: SaveChoice[] = ['save', 'discard', 'cancel']

function isFormat(value: unknown): value is DocumentFormat {
  if (typeof value !== 'object' || value === null) return false
  const format = value as Record<string, unknown>
  return (
    (format['eol'] === 'lf' || format['eol'] === 'crlf') &&
    typeof format['bom'] === 'boolean' &&
    typeof format['finalNewline'] === 'boolean'
  )
}

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

  ipcMain.handle(channels.fileWrite, (_event, path: unknown, text: unknown, format: unknown) => {
    if (typeof path !== 'string' || typeof text !== 'string' || !isFormat(format)) {
      throw new Error('Expected a path, text and format')
    }
    return writeDocument(root(), path, text, format)
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
