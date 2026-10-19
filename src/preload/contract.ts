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
  appMenus: 'app:menus',
  appOpenMenu: 'app:open-menu',
  appTitleBar: 'app:title-bar',
  imagePick: 'image:pick',
  imageSave: 'image:save',
  imageUnused: 'image:unused',
  imageRemove: 'image:remove',
  gitStatus: 'git:status',
  gitChanged: 'git:changed',
  gitCommit: 'git:commit',
  gitIdentity: 'git:identity',
  gitSetIdentity: 'git:set-identity',
  gitSync: 'git:sync',
  gitSyncFinish: 'git:sync-finish',
  gitSyncCancel: 'git:sync-cancel',
  gitConflictRead: 'git:conflict-read',
  gitConflictResolve: 'git:conflict-resolve',
  gitConflictFile: 'git:conflict-file',
  accountCurrent: 'account:current',
  accountChanged: 'account:changed',
  accountSignIn: 'account:sign-in',
  accountCancelSignIn: 'account:cancel-sign-in',
  accountSignOut: 'account:sign-out'
} as const

/** The answer to "Save changes?" */
export type SaveChoice = 'save' | 'discard' | 'cancel'

/** The window controls the system draws over the title bar, colored and sized from the tokens. */
export interface TitleBarOverlay {
  /** `#rrggbb` or `#rrggbbaa` */
  color: string
  symbolColor: string
  height: number
}

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
  /** A Sync stopped on conflicts and waits for the user's choices. */
  merging: boolean
}

/** The name and email Git puts on each version. */
export interface GitIdentity {
  name: string
  email: string
}

/** How a Sync ended. The version is saved on this computer in every case but `error`. */
export type SyncKind =
  | 'synced'
  | 'saved' // no online copy (no remote)
  | 'sign-in' // a GitHub remote needs the user signed in
  | 'ssh' // the remote is reached over SSH, which CoLeaf does not do yet
  | 'denied' // GitHub refused: no write access, or the app is not installed on the repository
  | 'offline'
  | 'conflicts'
  | 'error'

export interface SyncOutcome {
  kind: SyncKind
  /** Others' changes were brought in: files on disk changed, so open documents reload. */
  pulled: boolean
  /** `synced`: whether there was anything of ours to send. */
  pushed?: boolean
  /** `conflicts`: the files that need a choice. */
  files?: string[]
  /** `error`, `offline`, `denied`: what went wrong, in Git's or CoLeaf's words. */
  message?: string
}

/** A piece of a conflicted file: text both sides agree on, or the two versions of a part. */
export type ConflictPart =
  { kind: 'same'; text: string } | { kind: 'conflict'; mine: string; theirs: string }

/** What to keep for one conflicted part. */
export type ConflictChoice = 'mine' | 'theirs' | 'both'

/** The signed-in GitHub user. */
export interface Account {
  login: string
  avatarUrl: string
}

/** Signed in, signing in (the code to enter on GitHub), or signed out, with the last error. */
export interface AccountState {
  account: Account | null
  signIn: { userCode: string; verificationUri: string } | null
  error: string | null
}
