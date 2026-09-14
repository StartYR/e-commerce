import { createApp } from './app.js'
import { readConfig } from './config/env.js'
import { createDatabasePool } from './db/pool.js'
import { createAuthService } from './services/auth.js'
import { createPasswordService } from './services/passwords.js'
import { createCartService } from './services/cart.js'
import { createOrderService } from './services/orders.js'
import { createProductService } from './services/products.js'
import { createSessionService } from './services/sessions.js'
import { createUserService } from './services/users.js'

const config = readConfig()
const pool = createDatabasePool(config.database)
const productService = createProductService(pool)
const cartService = createCartService(pool)
const orderService = createOrderService(pool)
const authService = createAuthService({
  userService: createUserService(pool),
  sessionService: createSessionService(pool, config.session),
  passwordService: createPasswordService(),
})
const app = createApp({
  productService,
  authService,
  cartService,
  orderService,
  sessionConfig: config.session,
  isProduction: config.isProduction,
  originProxySecret: config.originProxySecret,
})

const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; shutting down`)
  server.close(async () => {
    try {
      await pool.end()
      process.exitCode = 0
    } catch {
      process.exitCode = 1
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
