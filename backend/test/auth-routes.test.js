import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { HttpError } from '../src/middleware/errors.js'

const productService = {
  listCategories: async () => [],
  listProducts: async () => [],
  getProduct: async () => null,
}
const cartService = {
  get: async () => ({ items: [] }),
  setItem: async () => ({ items: [] }),
  removeItem: async () => ({ items: [] }),
}

const orderService = {
  create: async () => {},
  list: async () => [],
  get: async () => {},
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await callback(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function buildApp(authService, sessionConfig = { cookieName: 'shiye_session', ttlDays: 7, secure: true }) {
  return createApp({ productService, authService, cartService, orderService, sessionConfig })
}

test('registration sets a host-only secure session cookie', async () => {
  const authService = {
    register: async () => ({
      user: { id: '1', username: 'reader', email: 'reader@example.com' },
      token: 'session-token',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    }),
    login: async () => {},
    findSessionUser: async () => null,
    removeSession: async () => {},
  }

  await withServer(buildApp(authService), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reader', email: 'reader@example.com', password: 'password123' }),
    })
    assert.equal(response.status, 201)
    const cookie = response.headers.get('set-cookie')
    assert.match(cookie, /^shiye_session=session-token;/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /Secure/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Path=\//i)
    assert.doesNotMatch(cookie, /Domain=/i)
  })
})

test('me resolves the database session and logout removes it', async () => {
  const removed = []
  const authService = {
    register: async () => {},
    login: async () => {},
    findSessionUser: async (token) => token === 'known-token'
      ? { id: '1', username: 'reader', email: 'reader@example.com' }
      : null,
    removeSession: async (token) => removed.push(token),
  }

  await withServer(buildApp(authService), async (baseUrl) => {
    const headers = { Cookie: 'shiye_session=known-token' }
    const meResponse = await fetch(`${baseUrl}/api/auth/me`, { headers })
    assert.equal(meResponse.status, 200)
    assert.equal((await meResponse.json()).user.username, 'reader')

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers })
    assert.equal(logoutResponse.status, 204)
    assert.deepEqual(removed, ['known-token'])
    const cookie = logoutResponse.headers.get('set-cookie')
    assert.match(cookie, /Max-Age=0/i)
    assert.doesNotMatch(cookie, /Domain=/i)
  })
})

test('login errors remain limited', async () => {
  const authService = {
    register: async () => {},
    login: async () => { throw new HttpError(401, 'INVALID_CREDENTIALS', 'Username/email or password is incorrect') },
    findSessionUser: async () => null,
    removeSession: async () => {},
  }

  await withServer(buildApp(authService), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'reader', password: 'incorrect' }),
    })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_CREDENTIALS', message: 'Username/email or password is incorrect' },
    })
  })
})
