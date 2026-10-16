// The IPC contract between the window and the background: channel names and the data they carry.
// Both sides import from here (types only in the window), so the allowlist is defined in one place.

export const channels = {
  projectOpen: 'project:open',
  projectClose: 'project:close',
  projectCurrent: 'project:current',
  projectListDir: 'project:list-dir',
  projectChanged: 'project:changed',
  projectDirChanged: 'project:dir-changed',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  dialogAskSave: 'dialog:ask-save',
  appSetUnsaved: 'app:set-unsaved',
  appSettleUnsaved: 'app:settle-unsaved',
  appUnsavedSettled: 'app:unsaved-settled'
} as const

/** The answer to "Save changes?" */
export type SaveChoice = 'save' | 'discard' | 'cancel'

/** The folder currently open in CoLeaf. */
export interface ProjectInfo {
  /** Absolute path of the folder. */
  root: string
  /** The folder's name, shown in the window title. */
  name: string
}

/** One row of the file tree. */
export interface TreeEntry {
  name: string
  /** Path relative to the project root, `/`-separated; `''` is the root itself. */
  path: string
  kind: 'dir' | 'file'
  isMarkdown: boolean
  /**
   * Folders only: whether a Markdown file lives anywhere under it. `false` also for folders that
   * are never scanned (`node_modules`, git-ignored); `undefined` while the background scan runs.
   */
  hasMarkdown?: boolean
}
