import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Turns the token into something safe to keep on disk and back (Electron's safeStorage). */
export interface Crypt {
  encrypt(text: string): string
  decrypt(text: string): string
}

export interface StoredAccount {
  token: string
  expiresAt: number | null
  login: string
  avatarUrl: string
}

/**
 * The signed-in account in a file under the app's data folder. The token is stored encrypted
 * only; without a way to encrypt it (no keychain), nothing is written and the sign-in lasts
 * for the session.
 */
export class AccountStore {
  constructor(
    private readonly file: string,
    private readonly crypt: Crypt | null
  ) {}

  /** The stored account, or null when there is none or it cannot be read back. */
  async load(): Promise<StoredAccount | null> {
    if (!this.crypt) return null
    try {
      const stored: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (typeof stored !== 'object' || stored === null) return null
      const record = stored as Record<string, unknown>
      const token = this.crypt.decrypt(String(record['token'] ?? ''))
      if (
        !token ||
        typeof record['login'] !== 'string' ||
        typeof record['avatarUrl'] !== 'string'
      ) {
        return null
      }
      const expiresAt = typeof record['expiresAt'] === 'number' ? record['expiresAt'] : null
      return { token, expiresAt, login: record['login'], avatarUrl: record['avatarUrl'] }
    } catch {
      return null
    }
  }

  /** Writes the account; `false` when it could not be kept (no encryption available). */
  async save(account: StoredAccount): Promise<boolean> {
    if (!this.crypt) return false
    const record = { ...account, token: this.crypt.encrypt(account.token) }
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.saving`
    await writeFile(temporary, JSON.stringify(record), 'utf8')
    await rename(temporary, this.file)
    return true
  }

  async clear(): Promise<void> {
    await rm(this.file, { force: true })
  }
}
