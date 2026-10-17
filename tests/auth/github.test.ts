import { createServer, type IncomingMessage, type Server } from 'node:http'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AccountService } from '../../src/main/auth/account'
import {
  clientId,
  fetchUser,
  pollForToken,
  requestDeviceCode,
  SignInError,
  type FlowOptions,
  type GitHubEndpoints
} from '../../src/main/auth/github'
import { AccountStore } from '../../src/main/auth/store'
import type { AccountState } from '../../src/preload/contract'

// A stand-in for GitHub: the device code, then a scripted list of answers to the polls.
interface Fake {
  server: Server
  endpoints: GitHubEndpoints
  answers: Record<string, unknown>[]
  requests: { url: string; body: string; authorization: string | undefined }[]
}

let fake: Fake

async function bodyOf(request: IncomingMessage): Promise<string> {
  let text = ''
  for await (const chunk of request) text += chunk
  return text
}

beforeAll(async () => {
  const answers: Fake['answers'] = []
  const requests: Fake['requests'] = []
  const server = createServer(async (request, response) => {
    const body = await bodyOf(request)
    requests.push({ url: request.url ?? '', body, authorization: request.headers.authorization })
    const reply = (status: number, payload: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(payload))
    }
    if (request.url === '/login/device/code') {
      reply(200, {
        device_code: 'device-1',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 0
      })
    } else if (request.url === '/login/oauth/access_token') {
      reply(200, answers.shift() ?? { error: 'authorization_pending' })
    } else if (request.url === '/user') {
      if (request.headers.authorization === 'Bearer ghu_token') {
        reply(200, { login: 'ada', avatar_url: 'https://example.com/ada.png' })
      } else reply(401, { message: 'Bad credentials' })
    } else reply(404, {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const base = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : ''
  fake = {
    server,
    answers,
    requests,
    endpoints: {
      deviceCode: `${base}/login/device/code`,
      accessToken: `${base}/login/oauth/access_token`,
      user: `${base}/user`
    }
  }
})

afterAll(() => new Promise<void>((resolve) => fake.server.close(() => resolve())))

beforeEach(() => {
  fake.answers.length = 0
  fake.requests.length = 0
})

const options = (): FlowOptions => ({
  endpoints: fake.endpoints,
  fetch: (input, init) => fetch(input, init),
  wait: () => Promise.resolve()
})

describe('device flow', () => {
  it('asks for a code, polls through pending and slow_down, then gets the token', async () => {
    fake.answers.push(
      { error: 'authorization_pending' },
      { error: 'slow_down', interval: 0 },
      { access_token: 'ghu_token', token_type: 'bearer', expires_in: 28800 }
    )
    const device = await requestDeviceCode(options())
    expect(device).toEqual({
      deviceCode: 'device-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      interval: 0
    })
    expect(fake.requests[0].body).toBe(`client_id=${clientId}`)

    const before = Date.now()
    const token = await pollForToken(device, options())
    expect(token.token).toBe('ghu_token')
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 28800 * 1000)
    const polls = fake.requests.filter((r) => r.url === '/login/oauth/access_token')
    expect(polls).toHaveLength(3)
    expect(polls[0].body).toContain(
      'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code'
    )
    expect(polls[0].body).toContain('device_code=device-1')

    const user = await fetchUser(token.token, options())
    expect(user).toEqual({ login: 'ada', avatarUrl: 'https://example.com/ada.png' })
  })

  it('explains an expired code, a refusal and a cancel', async () => {
    const device = await requestDeviceCode(options())
    fake.answers.push({ error: 'expired_token' })
    await expect(pollForToken(device, options())).rejects.toThrow(/code expired/)
    fake.answers.push({ error: 'access_denied' })
    await expect(pollForToken(device, options())).rejects.toThrow(/refused/)
    const controller = new AbortController()
    controller.abort()
    await expect(pollForToken(device, options(), controller.signal)).rejects.toThrow(/cancelled/)
    fake.answers.push({ error: 'incorrect_client_credentials', error_description: 'Bad app' })
    await expect(pollForToken(device, options())).rejects.toThrow('Bad app')
  })

  it('reports a bad token on the user lookup', async () => {
    await expect(fetchUser('wrong', options())).rejects.toThrow(SignInError)
  })
})

// Stands in for safeStorage: the token is not readable as written, and comes back whole.
const fakeCrypt = {
  encrypt: (t: string) => Buffer.from(t, 'utf8').toString('base64'),
  decrypt: (t: string) => Buffer.from(t, 'base64').toString('utf8')
}

describe('AccountStore', () => {
  const crypt = fakeCrypt

  it('keeps the token encrypted on disk and reads it back', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'coleaf-auth-')), 'nested', 'account.json')
    const store = new AccountStore(file, crypt)
    expect(await store.load()).toBeNull()
    const account = { token: 'ghu_secret', expiresAt: null, login: 'ada', avatarUrl: 'https://a' }
    expect(await store.save(account)).toBe(true)
    expect(await readFile(file, 'utf8')).not.toContain('ghu_secret')
    expect(await store.load()).toEqual(account)
    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('keeps nothing without encryption', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'coleaf-auth-')), 'account.json')
    const store = new AccountStore(file, null)
    const account = { token: 'ghu_secret', expiresAt: null, login: 'ada', avatarUrl: 'https://a' }
    expect(await store.save(account)).toBe(false)
    await expect(readFile(file, 'utf8')).rejects.toThrow()
  })
})

describe('AccountService', () => {
  async function service(
    states: AccountState[]
  ): Promise<{ service: AccountService; store: AccountStore }> {
    const file = join(await mkdtemp(join(tmpdir(), 'coleaf-auth-')), 'account.json')
    const store = new AccountStore(file, fakeCrypt)
    return {
      store,
      service: new AccountService({ ...options(), store, onChange: (state) => states.push(state) })
    }
  }

  it('shows the code while signing in, then the account, and keeps it for next time', async () => {
    const states: AccountState[] = []
    const { service: account, store } = await service(states)
    expect(account.token()).toBeNull()
    fake.answers.push({ access_token: 'ghu_token', token_type: 'bearer' })
    await account.signIn()
    expect(states).toEqual([
      {
        account: null,
        signIn: { userCode: 'ABCD-1234', verificationUri: 'https://github.com/login/device' },
        error: null
      },
      {
        account: { login: 'ada', avatarUrl: 'https://example.com/ada.png' },
        signIn: null,
        error: null
      }
    ])
    expect(account.token()).toBe('ghu_token')
    expect(await store.load()).toMatchObject({ login: 'ada', token: 'ghu_token' })

    const later: AccountState[] = []
    const next = new AccountService({ ...options(), store, onChange: (state) => later.push(state) })
    await next.load()
    expect(next.token()).toBe('ghu_token')
    expect(later[0].account?.login).toBe('ada')

    await next.signOut()
    expect(next.token()).toBeNull()
    expect(later.at(-1)).toEqual({ account: null, signIn: null, error: null })
    expect(await store.load()).toBeNull()
  })

  it('reports a failed sign-in and treats an expired token as signed out', async () => {
    const states: AccountState[] = []
    const { service: account, store } = await service(states)
    fake.answers.push({ error: 'access_denied' })
    await account.signIn()
    expect(states.at(-1)).toEqual({
      account: null,
      signIn: null,
      error: 'Sign-in was refused on GitHub.'
    })

    await store.save({
      token: 'old',
      expiresAt: Date.now() - 1000,
      login: 'ada',
      avatarUrl: 'https://a'
    })
    await account.load()
    expect(account.token()).toBeNull()
    expect(states.at(-1)?.account).toBeNull()
  })

  it('cancels a sign-in in progress without an error', async () => {
    const states: AccountState[] = []
    const { service: account } = await service(states)
    // Keep the poll pending until the cancel arrives.
    const pending = new AccountService({
      ...options(),
      wait: (_ms, signal) =>
        new Promise((resolve) => signal?.addEventListener('abort', () => resolve())),
      store: (await service([])).store,
      onChange: (state) => states.push(state)
    })
    const flow = pending.signIn()
    while (!states.some((state) => state.signIn)) await new Promise((r) => setTimeout(r, 5))
    pending.cancelSignIn()
    await flow
    expect(states.at(-1)).toEqual({ account: null, signIn: null, error: null })
    expect(account.token()).toBeNull()
  })
})
