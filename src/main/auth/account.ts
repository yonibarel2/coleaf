import type { AccountState } from '../../preload/contract'
import { fetchUser, pollForToken, requestDeviceCode, SignInError, type FlowOptions } from './github'
import type { AccountStore, StoredAccount } from './store'

export interface AccountOptions extends FlowOptions {
  store: AccountStore
  /** Every change of state: the window mirrors it. */
  onChange: (state: AccountState) => void
}

/** The GitHub account: signed out, signing in (a code on screen) or signed in, plus its token. */
export class AccountService {
  private stored: StoredAccount | null = null
  private signingIn: AbortController | null = null
  private error: string | null = null
  private code: AccountState['signIn'] = null

  constructor(private readonly options: AccountOptions) {}

  /** Picks up the account kept from last time; an expired token counts as signed out. */
  async load(): Promise<void> {
    const stored = await this.options.store.load()
    this.stored = stored && !expired(stored) ? stored : null
    this.options.onChange(this.current)
  }

  get current(): AccountState {
    return {
      account: this.stored ? { login: this.stored.login, avatarUrl: this.stored.avatarUrl } : null,
      signIn: this.code,
      error: this.error
    }
  }

  /** The token for Git and the API; null when signed out or expired. */
  token(): string | null {
    if (!this.stored || expired(this.stored)) return null
    return this.stored.token
  }

  /**
   * Runs the device flow: the code to enter reaches the window through `onChange` as soon as
   * GitHub gives it; the promise ends with the sign-in, either way.
   */
  async signIn(): Promise<void> {
    if (this.signingIn) return
    const controller = new AbortController()
    this.signingIn = controller
    this.error = null
    try {
      const device = await requestDeviceCode(this.options)
      if (controller.signal.aborted) throw new SignInError('Sign-in cancelled')
      this.code = { userCode: device.userCode, verificationUri: device.verificationUri }
      this.options.onChange(this.current)
      const token = await pollForToken(device, this.options, controller.signal)
      const user = await fetchUser(token.token, this.options)
      this.stored = { ...token, ...user }
      await this.options.store.save(this.stored)
    } catch (cause) {
      if (!controller.signal.aborted) {
        this.error = cause instanceof Error ? cause.message : String(cause)
      }
    } finally {
      if (this.signingIn === controller) this.signingIn = null
      this.code = null
      this.options.onChange(this.current)
    }
  }

  cancelSignIn(): void {
    this.signingIn?.abort()
    this.signingIn = null
  }

  async signOut(): Promise<void> {
    this.cancelSignIn()
    this.stored = null
    this.error = null
    await this.options.store.clear()
    this.options.onChange(this.current)
  }
}

function expired(account: StoredAccount): boolean {
  return account.expiresAt !== null && account.expiresAt <= Date.now()
}
