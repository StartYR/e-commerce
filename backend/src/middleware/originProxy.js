import { timingSafeEqual } from 'node:crypto'

function secretsMatch(received, expected) {
  const receivedBuffer = Buffer.from(received || '', 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function createOriginProxyMiddleware({ isProduction, secret }) {
  if (!isProduction) return (_request, _response, next) => next()
  if (!secret) throw new Error('ORIGIN_PROXY_SECRET is required in production')

  return (request, response, next) => {
    if (!secretsMatch(request.get('X-Origin-Proxy-Token'), secret)) {
      return response.status(403).json({
        error: { code: 'ORIGIN_FORBIDDEN', message: 'Forbidden' },
      })
    }
    return next()
  }
}
