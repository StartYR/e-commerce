import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { createOriginProxyMiddleware } from './middleware/originProxy.js'
import { createSessionMiddleware } from './middleware/session.js'
import { createAuthRouter } from './routes/auth.js'
import { createCartRouter } from './routes/cart.js'
import { createProductRouter } from './routes/products.js'

export function createApp({
  productService,
  authService,
  cartService,
  sessionConfig,
  isProduction = false,
  originProxySecret = '',
}) {
  if (!productService) throw new Error('productService is required')
  if (!authService) throw new Error('authService is required')
  if (!cartService) throw new Error('cartService is required')
  if (!sessionConfig) throw new Error('sessionConfig is required')

  const app = express()
  app.disable('x-powered-by')

  app.use('/api', createOriginProxyMiddleware({
    isProduction,
    secret: originProxySecret,
  }))
  app.use(express.json({ limit: '32kb' }))
  app.use('/api', createSessionMiddleware({
    authService,
    cookieName: sessionConfig.cookieName,
  }))
  app.use('/api', createAuthRouter({ authService, cookieConfig: sessionConfig }))
  app.use('/api', createCartRouter(cartService))
  app.use('/api', createProductRouter(productService))
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
