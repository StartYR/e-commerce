import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'

const sampleProduct = {
  id: 'notebook',
  name: '原野 · 布面笔记本',
  description: 'A5 / 横线内页 / 160 页',
  priceCents: 2800,
  stock: 68,
  isActive: true,
  categoryId: 'paper',
  categoryName: '纸本手帐',
}

function createFakeProductService(overrides = {}) {
  return {
    listCategories: async () => [{ id: 'paper', name: '纸本手帐' }],
    listProducts: async () => [sampleProduct],
    getProduct: async (id) => id === sampleProduct.id ? sampleProduct : null,
    ...overrides,
  }
}

function createFakeAuthService(overrides = {}) {
  return {
    register: async () => { throw new Error('not implemented in this test') },
    login: async () => { throw new Error('not implemented in this test') },
    findSessionUser: async () => null,
    removeSession: async () => {},
    ...overrides,
  }
}

function createFakeCartService(overrides = {}) {
  return {
    get: async () => ({ items: [] }),
    setItem: async () => ({ items: [] }),
    removeItem: async () => ({ items: [] }),
    ...overrides,
  }
}

function createTestApp(options = {}) {
  return createApp({
    productService: createFakeProductService(),
    authService: createFakeAuthService(),
    cartService: createFakeCartService(),
    sessionConfig: { cookieName: 'shiye_session', ttlDays: 7, secure: false },
    ...options,
  })
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  try {
    await callback(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

test('returns categories and products from the service', async () => {
  const app = createTestApp()
  await withServer(app, async (baseUrl) => {
    const categoriesResponse = await fetch(`${baseUrl}/api/categories`)
    assert.equal(categoriesResponse.status, 200)
    assert.deepEqual(await categoriesResponse.json(), {
      categories: [{ id: 'paper', name: '纸本手帐' }],
    })

    const productsResponse = await fetch(`${baseUrl}/api/products`)
    assert.equal(productsResponse.status, 200)
    assert.deepEqual(await productsResponse.json(), { products: [sampleProduct] })
  })
})

test('returns one product or a limited 404 error', async () => {
  const app = createTestApp()
  await withServer(app, async (baseUrl) => {
    const productResponse = await fetch(`${baseUrl}/api/products/notebook`)
    assert.equal(productResponse.status, 200)
    assert.deepEqual(await productResponse.json(), { product: sampleProduct })

    const missingResponse = await fetch(`${baseUrl}/api/products/missing`)
    assert.equal(missingResponse.status, 404)
    assert.deepEqual(await missingResponse.json(), {
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
    })
  })
})

test('requires the origin proxy token before production API routes', async () => {
  let serviceCalls = 0
  const app = createTestApp({
    productService: createFakeProductService({
      listProducts: async () => {
        serviceCalls += 1
        return [sampleProduct]
      },
    }),
    isProduction: true,
    originProxySecret: 'test-only-secret',
  })

  await withServer(app, async (baseUrl) => {
    const forbiddenResponse = await fetch(`${baseUrl}/api/products`)
    assert.equal(forbiddenResponse.status, 403)
    assert.equal(serviceCalls, 0)

    const wrongTokenResponse = await fetch(`${baseUrl}/api/products`, {
      headers: { 'X-Origin-Proxy-Token': 'wrong-secret-value' },
    })
    assert.equal(wrongTokenResponse.status, 403)
    assert.equal(serviceCalls, 0)

    const allowedResponse = await fetch(`${baseUrl}/api/products`, {
      headers: { 'X-Origin-Proxy-Token': 'test-only-secret' },
    })
    assert.equal(allowedResponse.status, 200)
    assert.equal(serviceCalls, 1)
  })
})

test('does not expose internal error details', async () => {
  const app = createTestApp({
    productService: createFakeProductService({
      listProducts: async () => { throw new Error('SELECT secret FROM hidden_table') },
    }),
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products`)
    const body = await response.text()
    assert.equal(response.status, 500)
    assert.doesNotMatch(body, /SELECT|hidden_table|stack/i)
    assert.deepEqual(JSON.parse(body), {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })
})
