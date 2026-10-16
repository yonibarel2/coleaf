import { app, ipcMain, type BrowserWindow } from 'electron'
import { channels } from '../../preload/contract'

// The window reports how many documents have unsaved changes. Before the window closes or the
// project changes, it gets to save or discard them (asking the user, like Word); the user may
// cancel, which drops the pending action.
let unsaved = 0
let pending: ((proceed: boolean) => void) | null = null

/** Wires the app messages of the preload allowlist. */
export function registerAppIpc(): void {
  ipcMain.on(channels.appSetUnsaved, (_event, count: unknown) => {
    unsaved = typeof count === 'number' ? count : 0
  })
  ipcMain.on(channels.appUnsavedSettled, (_event, proceed: unknown) => {
    const resolve = pending
    pending = null
    resolve?.(proceed === true)
  })
  app.on('browser-window-created', () => {
    unsaved = 0
    pending = null
  })
}

/** Lets the window deal with unsaved changes first. Resolves `false` when the user cancels. */
export function settleUnsaved(window: BrowserWindow | undefined): Promise<boolean> {
  if (unsaved === 0 || !window || window.isDestroyed()) return Promise.resolve(true)
  if (pending) return Promise.resolve(false) // one question at a time
  return new Promise((resolve) => {
    pending = resolve
    window.webContents.send(channels.appSettleUnsaved)
  })
}

/** Stops a close while documents are unsaved; closes once the window has settled them. */
export function guardClose(window: BrowserWindow): void {
  let closing = false
  window.on('close', (event) => {
    if (closing || unsaved === 0) return
    event.preventDefault()
    void settleUnsaved(window).then((proceed) => {
      if (!proceed || window.isDestroyed()) return
      closing = true
      window.close()
    })
  })
}
