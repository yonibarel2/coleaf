import { contextBridge } from 'electron'

// The allowlist: everything the window may ask the background to do, and nothing else.
// Empty in this slice; later slices add file and Git messages here.
const api = {}

contextBridge.exposeInMainWorld('coleaf', api)

export type CoLeafApi = typeof api
