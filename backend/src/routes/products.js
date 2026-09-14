import { Router } from 'express'
import { HttpError } from '../middleware/errors.js'

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response)).catch(next)
  }
}

export function createProductRouter(productService) {
  const router = Router()

  router.get('/categories', asyncRoute(async (_request, response) => {
    response.json({ categories: await productService.listCategories() })
  }))

  router.get('/products', asyncRoute(async (_request, response) => {
    response.json({ products: await productService.listProducts() })
  }))

  router.get('/products/:id', asyncRoute(async (request, response) => {
    const product = await productService.getProduct(request.params.id)
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
    response.json({ product })
  }))

  return router
}
