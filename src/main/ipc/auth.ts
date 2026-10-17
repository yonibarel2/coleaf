import { join } from 'node:path'
import { app, ipcMain, safeStorage } from 'electron'
import { channels } from '../../preload/contract'
import { AccountService } from '../auth/account'
import { githubEndpoints } from '../auth/github'
import { AccountStore, type Crypt } from '../auth/store'
import { broadcast } from './windows'

/** The account service on Electron's keychain-backed storage, under the app's data folder. */
export function createAccountService(): AccountService {
  const crypt: Crypt | null = safeStorage.isEncryptionAvailable()
    ? {
        encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
        decrypt: (text) => safeStorage.decryptString(Buffer.from(text, 'base64'))
      }
    : null
  const store = new AccountStore(join(app.getPath('userData'), 'github-account.json'), crypt)
  return new AccountService({
    store,
    endpoints: githubEndpoints,
    fetch: (input, init) => fetch(input, init),
    onChange: (state) => broadcast(channels.accountChanged, state)
  })
}

/** Wires the account messages of the preload allowlist. */
export function registerAuthIpc(service: AccountService): void {
  ipcMain.handle(channels.accountCurrent, () => service.current)
  // The sign-in runs on; its code and its end reach the window as state changes.
  ipcMain.handle(channels.accountSignIn, () => void service.signIn())
  ipcMain.handle(channels.accountCancelSignIn, () => service.cancelSignIn())
  ipcMain.handle(channels.accountSignOut, () => service.signOut())
}
