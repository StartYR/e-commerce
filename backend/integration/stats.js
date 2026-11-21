import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config/env.js'
import { createDatabasePool } from '../src/db/pool.js'
import { createAuthService } from '../src/services/auth.js'
import { createCartService } from '../src/services/cart.js'
import { createOrderService } from '../src/services/orders.js'
import { createPasswordService } from '../src/services/passwords.js'
import { createProductService } from '../src/services/products.js'
import { createSessionService } from '../src/services/sessions.js'
import { createStatsService } from '../src/services/stats.js'
import { createUserService } from '../src/services/users.js'

async function createOrders(pool, userId) {
  const fixtures = [
    ['2024-05-19 15:59:59.999999', 'placed', [['notebook', 1, 100]]],
    ['2024-05-19 16:00:00.000000', 'placed', [['notebook', 2, 2500], ['gel-pens', 1, 1500]]],
    ['2024-05-20 11:00:00.000000', 'cancelled', [['notebook', 99, 100]]],
    ['2024-05-20 15:59:59.999999', 'placed', [['notebook', 1, 3200]]],
    ['2024-05-20 16:00:00.000000', 'placed', [['gel-pens', 3, 1200]]],
    ['2024-05-21 16:00:00.000000', 'placed', [['notebook', 1, 100]]],
  ]
  const connection = await pool.getConnection()
  try {
    await connection.query("SET SESSION time_zone = '+00:00'")
    for (const [timestamp, status, items] of fixtures) {
      const total = items.reduce((sum, [, quantity, price]) => sum + quantity * price, 0)
      const [order] = await connection.execute(`
        INSERT INTO orders (user_id, total_amount_cents, status, created_at) VALUES (?, ?, ?, ?)
      `, [userId, total, status, timestamp])
      for (const [productId, quantity, price] of items) {
        await connection.execute(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)
        `, [String(order.insertId), productId, quantity, price])
      }
    }
  } finally {
    connection.destroy()
  }
}

test('real MySQL admin stats respect permissions, UTC+8 boundaries and stored prices', async (context) => {
  const config = readConfig()
  assert.equal(config.isProduction, false)
  const pool = createDatabasePool(config.database)
  const app = createApp({
    productService: createProductService(pool),
    authService: createAuthService({
      userService: createUserService(pool),
      sessionService: createSessionService(pool, config.session),
      passwordService: createPasswordService(),
    }),
    cartService: createCartService(pool),
    orderService: createOrderService(pool),
    statsService: createStatsService(pool),
    sessionConfig: config.session,
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`
  const statsUrl = `${baseUrl}/admin/stats?from=2024-05-20&to=2024-05-21`
  const username = `stats_${Date.now()}_${process.pid}`
  const email = `${username}@example.test`
  const password = 'stats-password-123'
  let userId
  let originalPrice

  try {
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, isAdmin: true }),
    })
    assert.equal(registration.status, 201)
    const { user } = await registration.json()
    userId = user.id
    assert.equal(user.isAdmin, false)
    const headers = { Cookie: registration.headers.get('set-cookie').split(';', 1)[0] }

    const anonymous = await fetch(statsUrl)
    assert.equal(anonymous.status, 401)
    assert.equal(anonymous.headers.get('cache-control'), 'no-store')
    assert.equal((await anonymous.json()).error.code, 'AUTH_REQUIRED')
    const forbidden = await fetch(statsUrl, { headers })
    assert.equal(forbidden.status, 403)
    assert.equal((await forbidden.json()).error.code, 'ADMIN_REQUIRED')

    await pool.execute('INSERT INTO admin_users (user_id) VALUES (?)', [userId])
    const session = await fetch(`${baseUrl}/auth/me`, { headers })
    assert.equal((await session.json()).user.isAdmin, true)
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: username, password }),
    })
    assert.equal(login.status, 200)
    assert.equal((await login.json()).user.isAdmin, true)

    for (const query of ['from=2024-05-20', 'from=2024-02-30&to=2024-03-01',
      'from=2024-05-21&to=2024-05-20', 'from=2024-05-01&to=2024-06-01',
      'from=2024-05-20&from=2024-05-19&to=2024-05-21']) {
      const invalidRange = await fetch(`${baseUrl}/admin/stats?${query}`, { headers })
      assert.equal(invalidRange.status, 400)
      assert.equal((await invalidRange.json()).error.code, 'INVALID_STATS_RANGE')
    }
    const emptyRange = await fetch(`${baseUrl}/admin/stats?from=2024-05-01&to=2024-05-18`, { headers })
    assert.equal(emptyRange.status, 200)
    assert.deepEqual(await emptyRange.json(), {
      from: '2024-05-01', to: '2024-05-18', timeZone: '+08:00', daily: [], products: [],
    })

    await createOrders(pool, userId)
    const reportResponse = await fetch(statsUrl, { headers })
    assert.equal(reportResponse.status, 200)
    assert.equal(reportResponse.headers.get('cache-control'), 'no-store')
    const report = await reportResponse.json()
    const summary = {
      daily: report.daily,
      products: report.products.map(({ name, ...totals }) => totals),
    }
    assert.deepEqual(summary.daily, [
      { date: '2024-05-20', orderCount: '2', amountCents: '9700' },
      { date: '2024-05-21', orderCount: '1', amountCents: '3600' },
    ])
    assert.deepEqual(summary.products, [
      { productId: 'notebook', unitsSold: '3', amountCents: '8200' },
      { productId: 'gel-pens', unitsSold: '4', amountCents: '5100' },
    ])

    const [[product]] = await pool.query("SELECT price_cents FROM products WHERE id = 'notebook'")
    originalPrice = product.price_cents
    await pool.execute("UPDATE products SET price_cents = ? WHERE id = 'notebook'", [originalPrice + 1000])
    const afterPriceChange = await fetch(statsUrl, { headers })
    assert.deepEqual(await afterPriceChange.json(), report)

    await pool.execute('DELETE FROM admin_users WHERE user_id = ?', [userId])
    const revoked = await fetch(statsUrl, { headers })
    assert.equal(revoked.status, 403)
    assert.equal((await revoked.json()).error.code, 'ADMIN_REQUIRED')
    context.diagnostic(JSON.stringify({ ...summary, productsRepriced: true, access: [401, 403, 200, 403] }))
  } finally {
    try {
      if (originalPrice !== undefined) {
        await pool.execute("UPDATE products SET price_cents = ? WHERE id = 'notebook'", [originalPrice])
      }
    } finally {
      try {
        if (userId) {
          await pool.execute('DELETE FROM orders WHERE user_id = ?', [userId])
          await pool.execute('DELETE FROM users WHERE id = ?', [userId])
        }
      } finally {
        await new Promise((resolve) => server.close(resolve))
        await pool.end()
      }
    }
  }
})
