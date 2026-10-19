import { isAbsolute, join, relative, sep } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type BaseWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { is } from '@electron-toolkit/utils'
import { channels } from '../preload/contract'
import { createDocument } from './files/document'
import { isMarkdownName } from './files/project'
import type { ProjectSession } from './files/session'
import { settleUnsaved } from './ipc/app'

/** Builds the application menu. Call again whenever the session changes. */
export function applyMenu(session: ProjectSession): void {
  const open = session.current !== null
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File…',
          accelerator: 'CmdOrCtrl+N',
          enabled: open,
          click: (_item, window) => void newFile(session, targetWindow(window))
        },
        {
          label: 'Open project…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, window) => {
            const target = targetWindow(window)
            void settleUnsaved(target).then((proceed) => {
              if (proceed) void session.open(target)
            })
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: open,
          click: (_item, window) => targetWindow(window)?.webContents.send(channels.appSave)
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          enabled: open,
          click: (_item, window) => {
            const target = targetWindow(window)
            void settleUnsaved(target).then((proceed) => {
              if (proceed) session.close()
            })
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: (_item, window) =>
            targetWindow(window)?.webContents.send(channels.appShowShortcuts)
        },
        { label: 'About CoLeaf', click: () => showAbout() }
      ]
    }
  ]
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' })
  if (is.dev) {
    template.splice(template.length - 1, 0, {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }]
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Wires the title bar's menu messages of the preload allowlist: the labels of the top-level
 * menus, and one of them dropped down from its label as a native menu.
 */
export function registerMenuIpc(): void {
  ipcMain.handle(channels.appMenus, () =>
    (Menu.getApplicationMenu()?.items ?? [])
      .filter((item) => item.visible)
      .map((item) => item.label)
  )
  ipcMain.handle(channels.appOpenMenu, (event, label: unknown, x: unknown, y: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const menu = Menu.getApplicationMenu()?.items.find((item) => item.label === label)?.submenu
    if (!window || !menu || typeof x !== 'number' || typeof y !== 'number') return Promise.resolve()
    return new Promise<void>((resolve) =>
      menu.popup({ window, x: Math.round(x), y: Math.round(y), callback: resolve })
    )
  })
}

// The window the menu item was chosen in, or the main window when none has focus.
function targetWindow(window: BaseWindow | undefined): BrowserWindow | undefined {
  return (window as BrowserWindow | undefined) ?? BrowserWindow.getAllWindows()[0]
}

/**
 * File › New File: asks where to put a blank `.md` file inside the project, creates it and
 * opens it in a tab. An existing file is never replaced, only opened.
 */
async function newFile(session: ProjectSession, window: BrowserWindow | undefined): Promise<void> {
  const project = session.current
  if (!project || !window) return
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    title: 'New File',
    defaultPath: join(project.root, 'untitled.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (canceled || !filePath) return
  const file = isMarkdownName(filePath) ? filePath : `${filePath}.md`
  const inside = relative(project.root, file)
  if (!inside || isAbsolute(inside) || inside.split(sep)[0] === '..') {
    await dialog.showMessageBox(window, {
      type: 'warning',
      message: 'Choose a place inside the project.',
      detail: project.root
    })
    return
  }
  const path = inside.split(sep).join('/')
  try {
    await createDocument(project.root, path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      dialog.showErrorBox('New File', error instanceof Error ? error.message : String(error))
      return
    }
  }
  window.webContents.send(channels.appOpenFile, path)
}

function showAbout(): void {
  void dialog.showMessageBox({
    type: 'info',
    title: 'About CoLeaf',
    message: 'CoLeaf',
    detail: `Version ${app.getVersion()}\nThe human layer for your repo.`
  })
}
