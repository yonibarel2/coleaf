import { basename, relative, sep } from 'node:path'
import { BrowserWindow, dialog, type BaseWindow } from 'electron'
import { channels, type ProjectInfo, type TreeEntry } from '../../preload/contract'
import { listDirectory, resolveInside } from './project'
import { DirectoryWatchers } from './watch'

type ChangeListener = (project: ProjectInfo | null) => void

/** The one project open in CoLeaf. Owned here; the window and the menu mirror it. */
export class ProjectSession {
  private project: ProjectInfo | null = null
  private readonly listeners = new Set<ChangeListener>()
  private readonly watchers = new DirectoryWatchers((dir) => this.notifyDirChanged(dir))

  get current(): ProjectInfo | null {
    return this.project
  }

  /** Asks the user for a folder and opens it. Keeps the current project when they cancel. */
  async open(parent: BaseWindow | undefined): Promise<ProjectInfo | null> {
    const options = { title: 'Open project', properties: ['openDirectory' as const] }
    const { canceled, filePaths } = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return this.project
    return this.openPath(filePaths[0])
  }

  openPath(root: string): ProjectInfo {
    this.watchers.closeAll()
    this.project = { root, name: basename(root) || root }
    this.emitChange()
    return this.project
  }

  close(): void {
    if (!this.project) return
    this.watchers.closeAll()
    this.project = null
    this.emitChange()
  }

  /** Lists a folder of the open project and starts following it for outside changes. */
  async listDir(path: string): Promise<TreeEntry[]> {
    if (!this.project) throw new Error('No project is open')
    const dir = await resolveInside(this.project.root, path)
    const entries = await listDirectory(this.project.root, path)
    this.watchers.watch(dir)
    return entries
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener(this.project)
    this.send(channels.projectChanged, this.project)
  }

  private notifyDirChanged(dir: string): void {
    if (!this.project) return
    this.send(channels.projectDirChanged, relative(this.project.root, dir).split(sep).join('/'))
  }

  private send(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }
}
