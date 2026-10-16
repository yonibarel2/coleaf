import { join } from 'node:path'
import { app, BrowserWindow, protocol, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { imagePathOf, imageScheme, readImage } from './files/images'
import { ProjectSession } from './files/session'
import { guardClose, registerAppIpc } from './ipc/app'
import { registerFileIpc } from './ipc/file'
import { registerImageIpc } from './ipc/images'
import { registerProjectIpc } from './ipc/project'
import { applyMenu } from './menu'
import icon from '../../build/icon.png?asset'

// Pictures in documents load through this scheme, served from inside the project only.
protocol.registerSchemesAsPrivileged([
  { scheme: imageScheme, privileges: { standard: true, secure: true } }
])

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CoLeaf',
    icon, // placeholder leaf (window and taskbar); the final logo comes in Stage 4
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The window never gets Node access: all disk and Git work goes through the preload's allowlist.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.on('ready-to-show', () => window.show())
  guardClose(window)

  // Web links open in the system browser; the window itself only ever shows the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const appOrigin = rendererUrl ?? 'file://'
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) event.preventDefault()
  })

  if (rendererUrl) {
    window.loadURL(rendererUrl)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.coleaf.app')

  // F12 opens DevTools in development; Ctrl/Cmd+R is ignored in production.
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const session = new ProjectSession()
  registerProjectIpc(session)
  registerFileIpc(session)
  registerImageIpc(session)
  registerAppIpc()
  applyMenu(session)
  session.onChange(() => applyMenu(session))
  app.on('will-quit', () => session.close())

  protocol.handle(imageScheme, async (request) => {
    const root = session.current?.root
    if (!root) return new Response(null, { status: 404 })
    try {
      const { bytes, type } = await readImage(root, imagePathOf(request.url))
      return new Response(new Uint8Array(bytes), { headers: { 'content-type': type } })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  createWindow()

  // Development only: open a folder at start, so the app can be driven without the native dialog.
  const devProject = is.dev ? process.env['COLEAF_PROJECT'] : undefined
  if (devProject) session.openPath(devProject)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
