import { BrowserWindow, dialog, ipcMain } from 'electron'
import { channels } from '../../preload/contract'
import { importImage, storeImage } from '../files/images'
import type { ProjectSession } from '../files/session'

const pictureExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']

/** Wires the picture messages of the preload allowlist. */
export function registerImageIpc(session: ProjectSession): void {
  const root = (): string => {
    if (!session.current) throw new Error('No project is open')
    return session.current.root
  }

  ipcMain.handle(channels.imagePick, async (event, documentPath: unknown): Promise<string[]> => {
    if (typeof documentPath !== 'string') throw new Error('Expected a document path')
    const options = {
      title: 'Insert picture',
      properties: ['openFile' as const, 'multiSelections' as const],
      filters: [{ name: 'Pictures', extensions: pictureExtensions }]
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (canceled) return []
    const saved: string[] = []
    for (const file of filePaths) saved.push(await importImage(root(), documentPath, file))
    return saved
  })

  ipcMain.handle(
    channels.imageSave,
    (_event, documentPath: unknown, name: unknown, bytes: unknown): Promise<string> => {
      if (typeof documentPath !== 'string' || typeof name !== 'string') {
        throw new Error('Expected a document path and a name')
      }
      if (!(bytes instanceof Uint8Array)) throw new Error('Expected the picture bytes')
      return storeImage(root(), documentPath, name, bytes)
    }
  )
}
