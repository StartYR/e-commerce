import { Router } from 'express'
import { HttpError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/session.js'

export function createStatsRouter(statsService) {
  const router = Router()

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/stats', requireAuth, async (request, response) => {
    if (request.user.isAdmin !== true) {
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Administrator access required')
    }
    response.json(await statsService.summarize(request.query.from, request.query.to))
  })

  return router
}
