import { Router } from 'express'
import { stringifySetCookie } from 'cookie'
import { HttpError } from '../middleware/errors.js'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response)).catch(next)
  }
}

function sessionCookie(cookieConfig, token, expiresAt) {
  return stringifySetCookie({
    name: cookieConfig.cookieName,
    value: token,
    httpOnly: true,
    secure: cookieConfig.secure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: cookieConfig.ttlDays * 24 * 60 * 60,
  })
}

function expiredSessionCookie(cookieConfig) {
  return stringifySetCookie({
    name: cookieConfig.cookieName,
    value: '',
    httpOnly: true,
    secure: cookieConfig.secure,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  })
}

export function createAuthRouter({ authService, cookieConfig }) {
  const router = Router()

  router.post('/auth/register', asyncRoute(async (request, response) => {
    const { user, token, expiresAt } = await authService.register(request.body)
    response.setHeader('Set-Cookie', sessionCookie(cookieConfig, token, expiresAt))
    response.status(201).json({ user })
  }))

  router.post('/auth/login', asyncRoute(async (request, response) => {
    const { user, token, expiresAt } = await authService.login(request.body)
    response.setHeader('Set-Cookie', sessionCookie(cookieConfig, token, expiresAt))
    response.json({ user })
  }))

  router.post('/auth/logout', asyncRoute(async (request, response) => {
    if (request.sessionToken) await authService.removeSession(request.sessionToken)
    response.setHeader('Set-Cookie', expiredSessionCookie(cookieConfig))
    response.status(204).end()
  }))

  router.get('/auth/me', (request, response, next) => {
    if (!request.user) return next(new HttpError(401, 'AUTH_REQUIRED', 'Authentication required'))
    return response.json({ user: request.user })
  })

  return router
}
