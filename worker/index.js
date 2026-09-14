const EXPECTED_API_ORIGIN = 'https://api.startyi.cn'
const ORIGIN_TOKEN_HEADER = 'X-Origin-Proxy-Token'

function errorResponse(status, code, message) {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function isApiRequest(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/')
}

async function proxyApiRequest(request, env) {
  if (env.API_ORIGIN !== EXPECTED_API_ORIGIN) {
    return errorResponse(500, 'INVALID_API_ORIGIN', 'API origin is not configured correctly')
  }
  if (typeof env.ORIGIN_PROXY_SECRET !== 'string' || env.ORIGIN_PROXY_SECRET.length === 0) {
    return errorResponse(500, 'MISSING_ORIGIN_SECRET', 'Origin proxy secret is not configured')
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, EXPECTED_API_ORIGIN)
  const headers = new Headers(request.headers)
  headers.set(ORIGIN_TOKEN_HEADER, env.ORIGIN_PROXY_SECRET)

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    ...(request.body ? { duplex: 'half' } : {}),
  })
  return fetch(upstreamRequest)
}

export default {
  fetch(request, env) {
    const url = new URL(request.url)
    if (isApiRequest(url)) return proxyApiRequest(request, env)
    return env.ASSETS.fetch(request)
  },
}
