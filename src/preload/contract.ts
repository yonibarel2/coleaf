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
  appUnsavedSettled: 'app:unsaved-settled',
  appSave: 'app:save',
  appOpenFile: 'app:open-file',
  appShowShortcuts: 'app:show-shortcuts',
  imagePick: 'image:pick',
  imageSave: 'image:save',
  gitStatus: 'git:status',
  gitChanged: 'git:changed',
  gitCommit: 'git:commit',
  gitIdentity: 'git:identity',
  gitSetIdentity: 'git:set-identity'
} as const

/** The answer to "Save changes?" */
export type SaveChoice = 'save' | 'discard' | 'cancel'

/** How a file is stored on disk; kept so that saving changes nothing but the text. */
export interface DocumentFormat {
  eol: 'lf' | 'crlf'
  bom: boolean
  finalNewline: boolean
}

/** A Markdown file as read: its text with `\n` line endings, plus how it is stored. */
export interface DocumentText extends DocumentFormat {
  text: string
  /** Not valid UTF-8: shown as well as possible, never written. */
  readOnly: boolean
}

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

/** How a file differs from the last version Git holds. */
export type ChangeKind = 'new' | 'modified' | 'deleted' | 'renamed' | 'conflict'

/** One row of the Sync view's "Changed files". */
export interface ChangedFile {
  /** Tree path, `/`-separated. */
  path: string
  kind: ChangeKind
  /** Renamed: where the file was before. */
  from?: string
}

/** The Git state of the open project, kept current by the background. */
export interface GitStatus {
  /** `false` when the project folder is not inside a Git repository. */
  repo: boolean
  /** The current branch, as Git names it; `null` without a repository. */
  branch: string | null
  changes: ChangedFile[]
}

/** The name and email Git puts on each version. */
export interface GitIdentity {
  name: string
  email: string
}
