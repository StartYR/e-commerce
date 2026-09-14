import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'

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

function buildApp(orderService) {
  return createApp({
    productService,
    authService,
    cartService,
    orderService,
    sessionConfig: { cookieName: 'shiye_session', ttlDays: 7, secure: false },
  })
}

test('all order routes require a valid server session', async () => {
  let calls = 0
  const orderService = {
    create: async () => { calls += 1 },
    list: async () => { calls += 1 },
    get: async () => { calls += 1 },
  }

  await withServer(buildApp(orderService), async (baseUrl) => {
    for (const [path, method] of [['/api/orders', 'POST'], ['/api/orders', 'GET'], ['/api/orders/7', 'GET']]) {
      const response = await fetch(`${baseUrl}${path}`, { method })
      assert.equal(response.status, 401)
      assert.equal((await response.json()).error.code, 'AUTH_REQUIRED')
    }
  })
  assert.equal(calls, 0)
})

test('order routes pass only the authenticated user and requested id to the service', async () => {
  const calls = []
  const order = { id: '7', totalAmountCents: 2800, status: 'placed', items: [] }
  const orderService = {
    create: async (userId) => { calls.push(['create', userId]); return order },
    list: async (userId) => { calls.push(['list', userId]); return [order] },
    get: async (userId, orderId) => { calls.push(['get', userId, orderId]); return order },
  }
  const headers = { Cookie: 'shiye_session=known-token' }

  await withServer(buildApp(orderService), async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers })
    assert.equal(createResponse.status, 201)
    assert.deepEqual(await createResponse.json(), { order })

    const listResponse = await fetch(`${baseUrl}/api/orders`, { headers })
    assert.equal(listResponse.status, 200)
    assert.deepEqual(await listResponse.json(), { orders: [order] })

    const detailResponse = await fetch(`${baseUrl}/api/orders/7`, { headers })
    assert.equal(detailResponse.status, 200)
    assert.deepEqual(await detailResponse.json(), { order })
  })

  assert.deepEqual(calls, [['create', '42'], ['list', '42'], ['get', '42', '7']])
})
