import { basename, join } from 'node:path'
import { BrowserWindow, dialog, type BaseWindow } from 'electron'
import { channels, type ProjectInfo, type TreeEntry } from '../../preload/contract'
import { GitTracker } from '../git/tracker'
import { ProjectIgnore } from './ignore'
import { MarkdownIndex } from './markdown-index'
import { kindOf, listDirectory } from './project'
import { ProjectWatcher } from './watch'

type ChangeListener = (project: ProjectInfo | null) => void

/** The one project open in CoLeaf. Owned here; the window and the menu mirror it. */
export class ProjectSession {
  private project: ProjectInfo | null = null
  private index: MarkdownIndex | undefined
  private readonly listeners = new Set<ChangeListener>()
  // Folders the window has listed: the ones to tell about changes.
  private readonly listed = new Set<string>()
  private readonly watcher = new ProjectWatcher((dir, paths) => void this.handleChanges(dir, paths))
  /** The project's Git status, refreshed after every change on disk. */
  readonly git = new GitTracker((status) => this.send(channels.gitChanged, status))

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
    this.reset()
    this.project = { root, name: basename(root) || root }
    const index = new MarkdownIndex(root, new ProjectIgnore(root))
    this.index = index
    this.watcher.watch(root)
    this.git.open(root)
    void index.scan().then(() => {
      if (this.index === index) this.notifyListed()
    })
    this.emitChange()
    return this.project
  }

  close(): void {
    if (!this.project) return
    this.reset()
    this.project = null
    this.emitChange()
  }

  /** Lists a folder of the open project; from then on the window hears about its changes. */
  async listDir(path: string): Promise<TreeEntry[]> {
    if (!this.project || !this.index) throw new Error('No project is open')
    const index = this.index
    const entries = await listDirectory(this.project.root, path, (dir) => index.status(dir))
    this.listed.add(path)
    return entries
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private reset(): void {
    this.watcher.close()
    this.git.close()
    this.index?.cancel()
    this.index = undefined
    this.listed.clear()
  }

  // Keeps the Git status and the Markdown index current, then tells the window which listed
  // folders to re-read. Changes under `.git` (a commit, a branch switch) reach the status too.
  private async handleChanges(dir: string, paths: string[]): Promise<void> {
    this.git.touch()
    const index = this.index
    if (!index || !this.project) return
    if (!index.ignore.isSkipped(dir)) {
      if (paths.some((path) => basename(path) === '.gitignore')) {
        await index.scan() // the rules changed: start over
        if (this.index === index) this.notifyListed()
        return
      }
      for (const path of paths) {
        const kind = await kindOf(join(this.project.root, path))
        if (kind === 'dir') await index.scanSubtree(path)
        else if (kind === undefined) index.prune(path)
      }
      await index.refresh(dir)
    }
    if (this.index !== index) return
    // The folder itself changed; its ancestors may have changed their Markdown status.
    for (let current = dir; ; current = current.slice(0, current.lastIndexOf('/'))) {
      if (this.listed.has(current)) this.send(channels.projectDirChanged, current)
      if (current === '') break
      if (!current.includes('/')) current = '/' // one more round for the root
    }
  }

  private notifyListed(): void {
    for (const path of this.listed) this.send(channels.projectDirChanged, path)
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener(this.project)
    this.send(channels.projectChanged, this.project)
  }

  private send(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }
}
