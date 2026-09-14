import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import worker from '../worker/index.js'

const validEnv = {
  API_ORIGIN: 'https://api.startyi.cn',
  ORIGIN_PROXY_SECRET: 'worker-test-secret',
  ASSETS: { fetch: async () => new Response('asset') },
}

test('Wrangler configuration targets only the existing shop Worker', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
  assert.equal(config.name, 'shop')
  assert.equal(config.main, './worker/index.js')
  assert.deepEqual(config.assets, {
    directory: './dist',
    binding: 'ASSETS',
    not_found_handling: 'single-page-application',
    run_worker_first: ['/api/*'],
  })
  assert.equal(config.vars.API_ORIGIN, 'https://api.startyi.cn')
  assert.deepEqual(config.secrets.required, ['ORIGIN_PROXY_SECRET'])
  assert.equal('route' in config, false)
  assert.equal('routes' in config, false)
  assert.equal('custom_domain' in config, false)
})

test('proxies API requests only to the fixed origin and overwrites the client token', async () => {
  const originalFetch = globalThis.fetch
  let upstreamRequest
  globalThis.fetch = async (request) => {
    upstreamRequest = request
    return new Response(JSON.stringify({ order: { id: '1' } }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'shiye_session=server-value; Path=/; Secure; HttpOnly',
      },
    })
  }

  try {
    const request = new Request('https://shop.yirui.io/api/orders?target=https://evil.example', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'shiye_session=browser-value',
        'X-Origin-Proxy-Token': 'client-controlled-value',
      },
      body: JSON.stringify({ example: true }),
    })
    const response = await worker.fetch(request, validEnv)

    assert.equal(response.status, 201)
    assert.equal(
      upstreamRequest.url,
      'https://api.startyi.cn/api/orders?target=https://evil.example',
    )
    assert.equal(upstreamRequest.method, 'POST')
    assert.equal(upstreamRequest.headers.get('X-Origin-Proxy-Token'), 'worker-test-secret')
    assert.equal(upstreamRequest.headers.get('Cookie'), 'shiye_session=browser-value')
    assert.equal(upstreamRequest.headers.get('Content-Type'), 'application/json')
    assert.deepEqual(await upstreamRequest.json(), { example: true })
    assert.match(response.headers.get('Set-Cookie'), /shiye_session=server-value/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('serves non-API requests from the Static Assets binding', async () => {
  let assetRequest
  const response = await worker.fetch(new Request('https://shop.yirui.io/orders/42'), {
    ...validEnv,
    ASSETS: {
      fetch: async (request) => {
        assetRequest = request
        return new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })
      },
    },
  })

  assert.equal(assetRequest.url, 'https://shop.yirui.io/orders/42')
  assert.equal(response.headers.get('Content-Type'), 'text/html')
})

test('rejects an invalid origin or missing required secret without making an outbound request', async () => {
  const originalFetch = globalThis.fetch
  let outboundRequests = 0
  globalThis.fetch = async () => {
    outboundRequests += 1
    return new Response()
  }

  try {
    const request = new Request('https://shop.yirui.io/api/products')
    const wrongOrigin = await worker.fetch(request, {
      ...validEnv,
      API_ORIGIN: 'https://evil.example',
    })
    assert.equal(wrongOrigin.status, 500)
    assert.equal((await wrongOrigin.json()).error.code, 'INVALID_API_ORIGIN')

    const missingSecret = await worker.fetch(request, {
      ...validEnv,
      ORIGIN_PROXY_SECRET: '',
    })
    assert.equal(missingSecret.status, 500)
    assert.equal((await missingSecret.json()).error.code, 'MISSING_ORIGIN_SECRET')
    assert.equal(outboundRequests, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})
