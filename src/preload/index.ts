import { contextBridge, ipcRenderer } from 'electron'
import {
  channels,
  type DocumentFormat,
  type DocumentText,
  type ProjectInfo,
  type SaveChoice,
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
    /** Insert › Picture: the user picks files; copies land under `images/`. Returns their tree paths. */
    pick: (documentPath: string): Promise<string[]> =>
      ipcRenderer.invoke(channels.imagePick, documentPath),
    /** A pasted or dropped picture, stored under `images/`. Returns its tree path. */
    save: (documentPath: string, name: string, bytes: Uint8Array): Promise<string> =>
      ipcRenderer.invoke(channels.imageSave, documentPath, name, bytes)
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
      subscribe(channels.appOpenFile, callback)
  }
}

contextBridge.exposeInMainWorld('coleaf', api)

export type CoLeafApi = typeof api
