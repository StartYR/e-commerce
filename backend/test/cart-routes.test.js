import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'

const productService = {
  listCategories: async () => [],
  listProducts: async () => [],
  getProduct: async () => null,
}

const authService = {
  register: async () => {},
  login: async () => {},
  findSessionUser: async (token) => token === 'known-token'
    ? { id: '42', username: 'reader', email: 'reader@example.com' }
    : null,
  removeSession: async () => {},
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

function buildApp(cartService) {
  return createApp({
    productService,
    authService,
    cartService,
    sessionConfig: { cookieName: 'shiye_session', ttlDays: 7, secure: false },
  })
}

test('cart routes require a valid server session', async () => {
  let calls = 0
  const cartService = {
    get: async () => { calls += 1 },
    setItem: async () => { calls += 1 },
    removeItem: async () => { calls += 1 },
  }

  await withServer(buildApp(cartService), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cart`)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    })
    assert.equal(calls, 0)
  })
})

test('authenticated cart routes pass the user, product, and quantity to the service', async () => {
  const calls = []
  const cart = { items: [] }
  const cartService = {
    get: async (userId) => { calls.push(['get', userId]); return cart },
    setItem: async (...args) => { calls.push(['set', ...args]); return cart },
    removeItem: async (...args) => { calls.push(['remove', ...args]); return cart },
  }
  const headers = { Cookie: 'shiye_session=known-token' }

  await withServer(buildApp(cartService), async (baseUrl) => {
    const getResponse = await fetch(`${baseUrl}/api/cart`, { headers })
    assert.equal(getResponse.status, 200)
    assert.deepEqual(await getResponse.json(), { cart })

    const putResponse = await fetch(`${baseUrl}/api/cart/items/notebook`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 3 }),
    })
    assert.equal(putResponse.status, 200)

    const deleteResponse = await fetch(`${baseUrl}/api/cart/items/notebook`, {
      method: 'DELETE',
      headers,
    })
    assert.equal(deleteResponse.status, 200)
  })

  assert.deepEqual(calls, [
    ['get', '42'],
    ['set', '42', 'notebook', 3],
    ['remove', '42', 'notebook'],
  ])
})
