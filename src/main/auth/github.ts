// GitHub sign-in with the device flow: GitHub shows a code, the user enters it in the browser,
// CoLeaf polls until GitHub hands over a user token. No secret is involved: the client ID is
// public and only names the CoLeaf GitHub App.

/** The CoLeaf GitHub App. Public by design; there is no client secret in a desktop app. */
export const clientId = 'Iv23li38PJ5AaF2yJOPH'

export interface GitHubEndpoints {
  deviceCode: string
  accessToken: string
  user: string
}

export const githubEndpoints: GitHubEndpoints = {
  deviceCode: 'https://github.com/login/device/code',
  accessToken: 'https://github.com/login/oauth/access_token',
  user: 'https://api.github.com/user'
}

export interface DeviceCode {
  deviceCode: string
  /** What the user types on GitHub. */
  userCode: string
  verificationUri: string
  /** Seconds between polls, as GitHub asks. */
  interval: number
}

export interface Token {
  token: string
  /** When the token stops working (ms since the epoch); null for a token that lasts. */
  expiresAt: number | null
}

export interface GitHubUser {
  login: string
  avatarUrl: string
}

/** The sign-in did not end with a token: the user's or GitHub's doing, told in plain words. */
export class SignInError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignInError'
  }
}

export interface FlowOptions {
  endpoints: GitHubEndpoints
  fetch: typeof fetch
  /** Pauses between polls; tests pass a faster one. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>
}

const formHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
}

/** Step one: asks GitHub for a code the user will enter. */
export async function requestDeviceCode({ endpoints, fetch }: FlowOptions): Promise<DeviceCode> {
  const response = await fetch(endpoints.deviceCode, {
    method: 'POST',
    headers: formHeaders,
    body: new URLSearchParams({ client_id: clientId }).toString()
  })
  const body = await json(response, 'GitHub did not start the sign-in')
  const userCode = body['user_code']
  const deviceCode = body['device_code']
  const verificationUri = body['verification_uri']
  if (
    typeof userCode !== 'string' ||
    typeof deviceCode !== 'string' ||
    typeof verificationUri !== 'string'
  ) {
    throw new SignInError('GitHub did not start the sign-in')
  }
  const interval = typeof body['interval'] === 'number' ? body['interval'] : 5
  return { deviceCode, userCode, verificationUri, interval }
}

/** Step two: polls until the user has entered the code; the token comes back. */
export async function pollForToken(
  device: DeviceCode,
  options: FlowOptions,
  signal?: AbortSignal
): Promise<Token> {
  const { endpoints, fetch } = options
  const wait = options.wait ?? pause
  let interval = device.interval
  for (;;) {
    await wait(interval * 1000, signal)
    if (signal?.aborted) throw new SignInError('Sign-in cancelled')
    const response = await fetch(endpoints.accessToken, {
      method: 'POST',
      headers: formHeaders,
      body: new URLSearchParams({
        client_id: clientId,
        device_code: device.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      }).toString(),
      signal
    })
    const body = await json(response, 'GitHub did not answer the sign-in')
    const token = body['access_token']
    if (typeof token === 'string') {
      const expiresIn = body['expires_in']
      const expiresAt = typeof expiresIn === 'number' ? Date.now() + expiresIn * 1000 : null
      return { token, expiresAt }
    }
    const error = body['error']
    if (error === 'authorization_pending') continue
    if (error === 'slow_down') {
      interval = typeof body['interval'] === 'number' ? body['interval'] : interval + 5
      continue
    }
    if (error === 'expired_token') throw new SignInError('The code expired. Try signing in again.')
    if (error === 'access_denied') throw new SignInError('Sign-in was refused on GitHub.')
    const description = body['error_description']
    throw new SignInError(typeof description === 'string' ? description : `GitHub said: ${error}`)
  }
}

/** Who the token belongs to. */
export async function fetchUser(
  token: string,
  { endpoints, fetch }: FlowOptions
): Promise<GitHubUser> {
  const response = await fetch(endpoints.user, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CoLeaf'
    }
  })
  const body = await json(response, 'GitHub did not say who signed in')
  const login = body['login']
  const avatarUrl = body['avatar_url']
  if (typeof login !== 'string' || typeof avatarUrl !== 'string') {
    throw new SignInError('GitHub did not say who signed in')
  }
  return { login, avatarUrl }
}

async function json(response: Response, failure: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new SignInError(`${failure} (${response.status})`)
  const body: unknown = await response.json().catch(() => null)
  if (typeof body !== 'object' || body === null) throw new SignInError(failure)
  return body as Record<string, unknown>
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
    function done(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
  })
}
