import { Router } from 'express'
import { requireAuth } from '../middleware/session.js'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response)).catch(next)
  }
}

export function createOrderRouter(orderService) {
  const router = Router()

  router.use('/orders', requireAuth)

  router.post('/orders', asyncRoute(async (request, response) => {
    response.status(201).json({ order: await orderService.create(request.user.id) })
  }))

  router.get('/orders', asyncRoute(async (request, response) => {
    response.json(await orderService.list(request.user.id, request.query.cursor))
  }))

  router.get('/orders/:id', asyncRoute(async (request, response) => {
    response.json({ order: await orderService.get(request.user.id, request.params.id) })
  }))

  return router
}
