import { contextBridge, ipcRenderer } from 'electron'
import { channels, type ProjectInfo, type TreeEntry } from './contract'

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
  }
}

contextBridge.exposeInMainWorld('coleaf', api)

export type CoLeafApi = typeof api
