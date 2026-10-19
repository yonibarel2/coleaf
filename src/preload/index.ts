import { contextBridge, ipcRenderer } from 'electron'
import {
  channels,
  type AccountState,
  type ConflictChoice,
  type ConflictPart,
  type DocumentFormat,
  type DocumentText,
  type GitIdentity,
  type GitStatus,
  type ProjectInfo,
  type SaveChoice,
  type SyncOutcome,
  type TitleBarOverlay,
  type TreeEntry
} from './contract'

// Subscribes to a one-way message from the background and returns the unsubscribe function.
// The window only ever sees the payload, never ipcRenderer itself.
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// The allowlist: everything the window may ask the background to do, and nothing else.
const api = {
  project: {
    open: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(channels.projectOpen),
    close: (): Promise<void> => ipcRenderer.invoke(channels.projectClose),
    getCurrent: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(channels.projectCurrent),
    listDir: (path: string): Promise<TreeEntry[]> =>
      ipcRenderer.invoke(channels.projectListDir, path),
    onChanged: (callback: (project: ProjectInfo | null) => void): (() => void) =>
      subscribe(channels.projectChanged, callback),
    onDirChanged: (callback: (path: string) => void): (() => void) =>
      subscribe(channels.projectDirChanged, callback)
  },
  file: {
    /** A Markdown file of the open project: its text and how it is stored. */
    read: (path: string): Promise<DocumentText> => ipcRenderer.invoke(channels.fileRead, path),
    /** Writes the text back in the file's original format. */
    write: (path: string, text: string, format: DocumentFormat): Promise<void> =>
      ipcRenderer.invoke(channels.fileWrite, path, text, format)
  },
  dialog: {
    askSave: (name: string): Promise<SaveChoice> => ipcRenderer.invoke(channels.dialogAskSave, name)
  },
  images: {
    /** Insert › Picture: the user picks files; copies land under `md-images/`. Returns their tree paths. */
    pick: (documentPath: string): Promise<string[]> =>
      ipcRenderer.invoke(channels.imagePick, documentPath),
    /** A pasted or dropped picture, stored under `md-images/`. Returns its tree path. */
    save: (documentPath: string, name: string, bytes: Uint8Array): Promise<string> =>
      ipcRenderer.invoke(channels.imageSave, documentPath, name, bytes),
    /** Pictures under `md-images/` that no Markdown file of the project uses. */
    unused: (): Promise<string[]> => ipcRenderer.invoke(channels.imageUnused),
    /** Deletes pictures under `md-images/`; nothing outside it. */
    remove: (paths: string[]): Promise<void> => ipcRenderer.invoke(channels.imageRemove, paths)
  },
  git: {
    /** The branch and the changed files of the open project, looked up now. */
    status: (): Promise<GitStatus> => ipcRenderer.invoke(channels.gitStatus),
    /** The status changed on disk (a save, a commit, another program). */
    onChanged: (callback: (status: GitStatus) => void): (() => void) =>
      subscribe(channels.gitChanged, callback),
    /** Saves a version with these files only; new and deleted files included. */
    commit: (paths: string[], message: string): Promise<void> =>
      ipcRenderer.invoke(channels.gitCommit, paths, message),
    /** The name and email on each version; empty strings when Git has none yet. */
    identity: (): Promise<GitIdentity> => ipcRenderer.invoke(channels.gitIdentity),
    /** Saves the name and email in the user's Git configuration, for every repository. */
    setIdentity: (identity: GitIdentity): Promise<void> =>
      ipcRenderer.invoke(channels.gitSetIdentity, identity),
    /** Sync: a version with these files (none: get the latest only), others' changes in, ours out. */
    sync: (paths: string[], message: string): Promise<SyncOutcome> =>
      ipcRenderer.invoke(channels.gitSync, paths, message),
    /** After every conflict has its choice: saves the merged version and shares it. */
    finishSync: (): Promise<SyncOutcome> => ipcRenderer.invoke(channels.gitSyncFinish),
    /** Drops a Sync stopped on conflicts; the files go back to our version. */
    cancelSync: (): Promise<void> => ipcRenderer.invoke(channels.gitSyncCancel),
    /** The parts of a conflicted file: shared text and, per conflict, mine and theirs. */
    readConflict: (path: string): Promise<ConflictPart[]> =>
      ipcRenderer.invoke(channels.gitConflictRead, path),
    /** Writes one choice per conflict into the file and settles it. */
    resolveConflict: (path: string, choices: ConflictChoice[]): Promise<void> =>
      ipcRenderer.invoke(channels.gitConflictResolve, path, choices),
    /** Settles a conflicted file as a whole with one side's version. */
    resolveFile: (path: string, side: 'mine' | 'theirs'): Promise<void> =>
      ipcRenderer.invoke(channels.gitConflictFile, path, side)
  },
  account: {
    /** Signed in, signing in, or signed out. */
    getCurrent: (): Promise<AccountState> => ipcRenderer.invoke(channels.accountCurrent),
    onChanged: (callback: (state: AccountState) => void): (() => void) =>
      subscribe(channels.accountChanged, callback),
    /** Starts the GitHub sign-in; the code to enter arrives through `onChanged`. */
    signIn: (): Promise<void> => ipcRenderer.invoke(channels.accountSignIn),
    cancelSignIn: (): Promise<void> => ipcRenderer.invoke(channels.accountCancelSignIn),
    signOut: (): Promise<void> => ipcRenderer.invoke(channels.accountSignOut)
  },
  app: {
    /** How many open documents have unsaved changes. */
    setUnsaved: (count: number): void => ipcRenderer.send(channels.appSetUnsaved, count),
    /**
     * Before closing the window or switching projects with unsaved changes, the background asks
     * the window to save or discard them; the window answers with `unsavedSettled`.
     */
    onSettleUnsaved: (callback: () => void): (() => void) =>
      subscribe<undefined>(channels.appSettleUnsaved, callback),
    /** `false` when the user cancelled: the pending close or switch is dropped. */
    unsavedSettled: (proceed: boolean): void =>
      ipcRenderer.send(channels.appUnsavedSettled, proceed),
    /** File › Save (Ctrl+S): save the active document. */
    onSave: (callback: () => void): (() => void) =>
      subscribe<undefined>(channels.appSave, callback),
    /** File › New File: the background created this file; open it in a tab. */
    onOpenFile: (callback: (path: string) => void): (() => void) =>
      subscribe(channels.appOpenFile, callback),
    /** Help › Keyboard Shortcuts. */
    onShowShortcuts: (callback: () => void): (() => void) =>
      subscribe<undefined>(channels.appShowShortcuts, callback),
    /** The title bar's menus (File, Help), in order. */
    menus: (): Promise<string[]> => ipcRenderer.invoke(channels.appMenus),
    /** Opens one as a native menu at a point of the window; settles when it closes. */
    openMenu: (label: string, x: number, y: number): Promise<void> =>
      ipcRenderer.invoke(channels.appOpenMenu, label, x, y),
    /** Colors and sizes the system's window controls like the title bar. */
    setTitleBarOverlay: (overlay: TitleBarOverlay): void =>
      ipcRenderer.send(channels.appTitleBar, overlay)
  }
}

contextBridge.exposeInMainWorld('coleaf', api)

export type CoLeafApi = typeof api
