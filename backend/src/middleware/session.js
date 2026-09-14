import { parseCookie } from 'cookie'
import { HttpError } from './errors.js'

export function createSessionMiddleware({ authService, cookieName }) {
  return async (request, _response, next) => {
    try {
      const token = parseCookie(request.headers.cookie || '')[cookieName]
      request.sessionToken = token || null
      request.user = token ? await authService.findSessionUser(token) : null
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireAuth(request, _response, next) {
  if (!request.user) {
    return next(new HttpError(401, 'AUTH_REQUIRED', 'Authentication required'))
  }
  next()
}
