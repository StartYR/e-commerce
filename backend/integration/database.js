import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config/env.js'
import { createDatabasePool } from '../src/db/pool.js'
import { createAuthService } from '../src/services/auth.js'
import { createCartService } from '../src/services/cart.js'
import { createPasswordService } from '../src/services/passwords.js'
import { createProductService } from '../src/services/products.js'
import { createSessionService } from '../src/services/sessions.js'
import { createUserService } from '../src/services/users.js'

function cookieHeader(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] || ''
}

test('real MySQL supports products, authentication, sessions, and carts', async () => {
  const config = readConfig()
  assert.equal(config.isProduction, false)

  const pool = createDatabasePool(config.database)
  const productService = createProductService(pool)
  const cartService = createCartService(pool)
  const authService = createAuthService({
    userService: createUserService(pool),
    sessionService: createSessionService(pool, config.session),
    passwordService: createPasswordService(),
  })
  const app = createApp({
    productService,
    cartService,
    authService,
    sessionConfig: config.session,
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const suffix = `${Date.now()}_${process.pid}`
  const username = `integration_${suffix}`
  const email = `${username}@example.test`
  const password = 'integration-password-123'
  let userId

  try {
    const [identityRows] = await pool.query('SELECT CURRENT_USER() AS currentUser')
    assert.match(identityRows[0].currentUser, /^ecommerce_app@/)
    const [grantRows] = await pool.query('SHOW GRANTS')
    const grants = grantRows.map((row) => Object.values(row)[0]).join('\n')
    assert.match(grants, /GRANT SELECT, INSERT, UPDATE, DELETE ON `ecommerce`\.\*/)
    assert.doesNotMatch(grants, /ALL PRIVILEGES|GRANT OPTION/)

    const [databaseProducts] = await pool.query(`
      SELECT p.id, p.name, p.description, p.price_cents AS priceCents,
             p.stock, p.is_active AS isActive, c.id AS categoryId
      FROM products AS p
      INNER JOIN categories AS c ON c.id = p.category_id
      WHERE p.is_active = TRUE
      ORDER BY p.id
    `)
    const productResponse = await fetch(`${baseUrl}/api/products`)
    assert.equal(productResponse.status, 200)
    const apiProducts = (await productResponse.json()).products
    assert.equal(apiProducts.length, 12)
    assert.deepEqual(
      apiProducts.map(({ id, name, description, priceCents, stock, isActive, categoryId }) => ({
        id, name, description, priceCents, stock, isActive: Number(isActive), categoryId,
      })),
      databaseProducts.map((product) => ({ ...product, isActive: Number(product.isActive) })),
    )

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    assert.equal(registerResponse.status, 201)
    const registered = await registerResponse.json()
    userId = registered.user.id
    const registrationCookie = cookieHeader(registerResponse)
    assert.ok(registrationCookie)

    const firstMeResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: registrationCookie },
    })
    assert.equal(firstMeResponse.status, 200)
    assert.equal((await firstMeResponse.json()).user.id, userId)

    const [sessionRows] = await pool.execute(
      'SELECT COUNT(*) AS sessionCount FROM sessions WHERE user_id = ?',
      [userId],
    )
    assert.equal(Number(sessionRows[0].sessionCount), 1)

    const firstLogoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: registrationCookie },
    })
    assert.equal(firstLogoutResponse.status, 204)

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: username, password }),
    })
    assert.equal(loginResponse.status, 200)
    const loginCookie = cookieHeader(loginResponse)
    assert.ok(loginCookie)

    const putCartResponse = await fetch(`${baseUrl}/api/cart/items/notebook`, {
      method: 'PUT',
      headers: { Cookie: loginCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 3 }),
    })
    assert.equal(putCartResponse.status, 200)
    assert.equal((await putCartResponse.json()).cart.items[0].quantity, 3)

    const getCartResponse = await fetch(`${baseUrl}/api/cart`, {
      headers: { Cookie: loginCookie },
    })
    assert.equal(getCartResponse.status, 200)
    const persistedCart = (await getCartResponse.json()).cart
    assert.deepEqual(
      persistedCart.items.map(({ productId, quantity }) => ({ productId, quantity })),
      [{ productId: 'notebook', quantity: 3 }],
    )

    const deleteCartResponse = await fetch(`${baseUrl}/api/cart/items/notebook`, {
      method: 'DELETE',
      headers: { Cookie: loginCookie },
    })
    assert.equal(deleteCartResponse.status, 200)
    assert.deepEqual((await deleteCartResponse.json()).cart.items, [])
  } finally {
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId])
    server.close()
    await once(server, 'close')
    await pool.end()
  }
})
