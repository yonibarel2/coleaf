import { app, BrowserWindow, dialog, Menu, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { ProjectSession } from './files/session'
import { settleUnsaved } from './ipc/app'

/** Builds the application menu. Call again whenever the session changes. */
export function applyMenu(session: ProjectSession): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open project…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, window) => {
            const target = (window as BrowserWindow | undefined) ?? BrowserWindow.getAllWindows()[0]
            void settleUnsaved(target).then((proceed) => {
              if (proceed) void session.open(target)
            })
          }
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          enabled: session.current !== null,
          click: (_item, window) => {
            const target = (window as BrowserWindow | undefined) ?? BrowserWindow.getAllWindows()[0]
            void settleUnsaved(target).then((proceed) => {
              if (proceed) session.close()
            })
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [{ label: 'About CoLeaf', click: () => showAbout() }]
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

function showAbout(): void {
  void dialog.showMessageBox({
    type: 'info',
    title: 'About CoLeaf',
    message: 'CoLeaf',
    detail: `Version ${app.getVersion()}\nThe human layer for your repo.`
  })
}
