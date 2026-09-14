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
import { createUserService } from '../src/services/users.js'

function cookieHeader(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] || ''
}

async function register(baseUrl, label, suffix) {
  const username = `${label}_${suffix}`
  const email = `${username}@example.test`
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password: 'orders-password-123' }),
  })
  assert.equal(response.status, 201)
  return {
    user: (await response.json()).user,
    cookie: cookieHeader(response),
    email,
  }
}

async function setCartItem(baseUrl, cookie, productId, quantity) {
  const response = await fetch(`${baseUrl}/api/cart/items/${productId}`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })
  assert.equal(response.status, 200)
  return (await response.json()).cart
}

async function getCart(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/cart`, { headers: { Cookie: cookie } })
  assert.equal(response.status, 200)
  return (await response.json()).cart
}

function createTwoPartyGate() {
  let arrivals = 0
  let open
  const opened = new Promise((resolve) => { open = resolve })
  return async () => {
    arrivals += 1
    if (arrivals === 2) open()
    await opened
  }
}

test('real MySQL orders preserve snapshots, ownership, rollback, and concurrent stock safety', async () => {
  const config = readConfig()
  assert.equal(config.isProduction, false)

  const pool = createDatabasePool(config.database)
  let beforeProductLock = null
  const orderPool = {
    execute: (...args) => pool.execute(...args),
    getConnection: async () => {
      const connection = await pool.getConnection()
      return new Proxy(connection, {
        get(target, property) {
          if (property === 'execute') {
            return async (sql, parameters) => {
              if (beforeProductLock && sql.includes('FROM cart_items')) {
                await beforeProductLock()
              }
              return target.execute(sql, parameters)
            }
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    },
  }
  const orderService = createOrderService(orderPool)
  const authService = createAuthService({
    userService: createUserService(pool),
    sessionService: createSessionService(pool, config.session),
    passwordService: createPasswordService(),
  })
  const app = createApp({
    productService: createProductService(pool),
    cartService: createCartService(pool),
    orderService,
    authService,
    sessionConfig: config.session,
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const suffix = `${Date.now()}_${process.pid}`
  const users = []
  const productIds = ['notebook', 'clips']
  let originalProducts = []

  try {
    const [identityRows] = await pool.query('SELECT CURRENT_USER() AS currentUser')
    assert.match(identityRows[0].currentUser, /^ecommerce_app@/)

    const [productRows] = await pool.query(`
      SELECT id, price_cents AS priceCents, stock, is_active AS isActive
      FROM products
      WHERE id IN ('notebook', 'clips')
      ORDER BY id
    `)
    originalProducts = productRows
    assert.equal(originalProducts.length, 2)

    const owner = await register(baseUrl, 'orders_owner', suffix)
    const other = await register(baseUrl, 'orders_other', suffix)
    users.push(owner, other)

    await pool.execute(`
      UPDATE products
      SET price_cents = 2800, stock = 10, is_active = TRUE
      WHERE id = 'notebook'
    `)
    await setCartItem(baseUrl, owner.cookie, 'notebook', 2)

    const placedResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
    })
    assert.equal(placedResponse.status, 201)
    const placedOrder = (await placedResponse.json()).order
    assert.equal(placedOrder.status, 'placed')
    assert.equal(placedOrder.totalAmountCents, 5600)
    assert.deepEqual(
      placedOrder.items.map(({ productId, quantity, unitPriceCents }) => ({ productId, quantity, unitPriceCents })),
      [{ productId: 'notebook', quantity: 2, unitPriceCents: 2800 }],
    )
    assert.deepEqual((await getCart(baseUrl, owner.cookie)).items, [])

    const [stockAfterOrder] = await pool.query(`
      SELECT stock
      FROM products
      WHERE id = 'notebook'
    `)
    assert.equal(Number(stockAfterOrder[0].stock), 8)

    await pool.execute(`
      UPDATE products
      SET price_cents = 4321
      WHERE id = 'notebook'
    `)

    const listResponse = await fetch(`${baseUrl}/api/orders`, { headers: { Cookie: owner.cookie } })
    assert.equal(listResponse.status, 200)
    const listedOrder = (await listResponse.json()).orders.find((order) => order.id === placedOrder.id)
    assert.ok(listedOrder)
    assert.equal(listedOrder.items[0].unitPriceCents, 2800)

    const detailResponse = await fetch(`${baseUrl}/api/orders/${placedOrder.id}`, {
      headers: { Cookie: owner.cookie },
    })
    assert.equal(detailResponse.status, 200)
    const detailedOrder = (await detailResponse.json()).order
    assert.equal(detailedOrder.items[0].unitPriceCents, 2800)

    const [databaseOrderRows] = await pool.execute(`
      SELECT o.id, o.user_id AS userId, o.total_amount_cents AS totalAmountCents,
             o.status, oi.product_id AS productId, oi.quantity,
             oi.unit_price_cents AS unitPriceCents
      FROM orders AS o
      INNER JOIN order_items AS oi ON oi.order_id = o.id
      WHERE o.id = ?
    `, [placedOrder.id])
    assert.equal(String(databaseOrderRows[0].id), placedOrder.id)
    assert.equal(String(databaseOrderRows[0].userId), String(owner.user.id))
    assert.equal(Number(databaseOrderRows[0].totalAmountCents), detailedOrder.totalAmountCents)
    assert.equal(databaseOrderRows[0].status, detailedOrder.status)
    assert.equal(Number(databaseOrderRows[0].unitPriceCents), detailedOrder.items[0].unitPriceCents)

    const forbiddenDetail = await fetch(`${baseUrl}/api/orders/${placedOrder.id}`, {
      headers: { Cookie: other.cookie },
    })
    assert.equal(forbiddenDetail.status, 404)
    assert.equal((await forbiddenDetail.json()).error.code, 'ORDER_NOT_FOUND')
    const otherList = await fetch(`${baseUrl}/api/orders`, { headers: { Cookie: other.cookie } })
    assert.equal(otherList.status, 200)
    assert.deepEqual((await otherList.json()).orders, [])

    await setCartItem(baseUrl, owner.cookie, 'notebook', 9)
    const [ordersBeforeFailure] = await pool.execute(
      'SELECT COUNT(*) AS orderCount FROM orders WHERE user_id = ?',
      [owner.user.id],
    )
    const insufficientResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
    })
    assert.equal(insufficientResponse.status, 409)
    assert.equal((await insufficientResponse.json()).error.code, 'INSUFFICIENT_STOCK')
    assert.deepEqual(
      (await getCart(baseUrl, owner.cookie)).items.map(({ productId, quantity }) => ({ productId, quantity })),
      [{ productId: 'notebook', quantity: 9 }],
    )
    const [ordersAfterFailure] = await pool.execute(
      'SELECT COUNT(*) AS orderCount FROM orders WHERE user_id = ?',
      [owner.user.id],
    )
    assert.equal(Number(ordersAfterFailure[0].orderCount), Number(ordersBeforeFailure[0].orderCount))
    const [stockAfterFailure] = await pool.query("SELECT stock FROM products WHERE id = 'notebook'")
    assert.equal(Number(stockAfterFailure[0].stock), 8)

    const removeNotebook = await fetch(`${baseUrl}/api/cart/items/notebook`, {
      method: 'DELETE',
      headers: { Cookie: owner.cookie },
    })
    assert.equal(removeNotebook.status, 200)

    await pool.execute(`
      UPDATE products
      SET stock = 1, is_active = TRUE
      WHERE id = 'clips'
    `)
    await Promise.all([
      setCartItem(baseUrl, owner.cookie, 'clips', 1),
      setCartItem(baseUrl, other.cookie, 'clips', 1),
    ])

    beforeProductLock = createTwoPartyGate()
    let concurrentResults
    try {
      concurrentResults = await Promise.all([
        fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { Cookie: owner.cookie } }),
        fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { Cookie: other.cookie } }),
      ])
    } finally {
      beforeProductLock = null
    }
    assert.deepEqual(concurrentResults.map((response) => response.status).sort(), [201, 409])

    const resultBodies = await Promise.all(concurrentResults.map((response) => response.json()))
    const winnerIndex = concurrentResults.findIndex((response) => response.status === 201)
    const loserIndex = 1 - winnerIndex
    assert.equal(resultBodies[loserIndex].error.code, 'INSUFFICIENT_STOCK')

    const [finalStockRows] = await pool.query("SELECT stock FROM products WHERE id = 'clips'")
    assert.equal(Number(finalStockRows[0].stock), 0)
    assert.ok(Number(finalStockRows[0].stock) >= 0)

    const [concurrentOrderItems] = await pool.execute(`
      SELECT o.user_id AS userId, oi.order_id AS orderId, oi.quantity
      FROM order_items AS oi
      INNER JOIN orders AS o ON o.id = oi.order_id
      WHERE oi.product_id = 'clips' AND o.user_id IN (?, ?)
    `, [owner.user.id, other.user.id])
    assert.equal(concurrentOrderItems.length, 1)
    assert.equal(Number(concurrentOrderItems[0].quantity), 1)
    assert.equal(String(concurrentOrderItems[0].userId), String(users[winnerIndex].user.id))

    assert.deepEqual((await getCart(baseUrl, users[winnerIndex].cookie)).items, [])
    assert.deepEqual(
      (await getCart(baseUrl, users[loserIndex].cookie)).items.map(({ productId, quantity }) => ({ productId, quantity })),
      [{ productId: 'clips', quantity: 1 }],
    )

    const [loserOrderItems] = await pool.execute(`
      SELECT COUNT(*) AS itemCount
      FROM order_items AS oi
      INNER JOIN orders AS o ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = 'clips'
    `, [users[loserIndex].user.id])
    assert.equal(Number(loserOrderItems[0].itemCount), 0)
  } finally {
    try {
      for (const product of originalProducts) {
        await pool.execute(`
          UPDATE products
          SET price_cents = ?, stock = ?, is_active = ?
          WHERE id = ?
        `, [product.priceCents, product.stock, product.isActive, product.id])
      }
    } finally {
      try {
        if (users.length > 0) {
          const userIds = users.map(({ user }) => user.id)
          const placeholders = userIds.map(() => '?').join(', ')
          await pool.execute(`
            DELETE oi
            FROM order_items AS oi
            INNER JOIN orders AS o ON o.id = oi.order_id
            WHERE o.user_id IN (${placeholders})
          `, userIds)
          await pool.execute(`DELETE FROM orders WHERE user_id IN (${placeholders})`, userIds)
          await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, userIds)
        }
      } finally {
        server.close()
        await once(server, 'close')
        await pool.end()
      }
    }
  }
})
