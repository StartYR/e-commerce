import { Router } from 'express'
import { requireAuth } from '../middleware/session.js'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response)).catch(next)
  }
}

export function createCartRouter(cartService) {
  const router = Router()

  router.use('/cart', requireAuth)

  router.get('/cart', asyncRoute(async (request, response) => {
    response.json({ cart: await cartService.get(request.user.id) })
  }))

  router.put('/cart/items/:productId', asyncRoute(async (request, response) => {
    const cart = await cartService.setItem(
      request.user.id,
      request.params.productId,
      request.body?.quantity,
    )
    response.json({ cart })
  }))

  router.delete('/cart/items/:productId', asyncRoute(async (request, response) => {
    const cart = await cartService.removeItem(request.user.id, request.params.productId)
    response.json({ cart })
  }))

  return router
}
