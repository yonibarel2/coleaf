import { app, BrowserWindow, ipcMain } from 'electron'
import { channels, type TitleBarOverlay } from '../../preload/contract'

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
  // The window controls the system draws over the title bar: the window sends the tokens' values.
  ipcMain.on(channels.appTitleBar, (event, overlay: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || process.platform === 'darwin' || !isOverlay(overlay)) return
    window.setTitleBarOverlay(overlay)
  })
}

// `#rrggbb` or `#rrggbbaa`: the overlay accepts transparency.
const isColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)

function isOverlay(value: unknown): value is TitleBarOverlay {
  if (typeof value !== 'object' || value === null) return false
  const { color, symbolColor, height } = value as Record<string, unknown>
  return isColor(color) && isColor(symbolColor) && Number.isInteger(height) && Number(height) > 0
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
