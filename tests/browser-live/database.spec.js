import { expect, test } from '@playwright/test'
import assert from 'node:assert/strict'
import { readConfig } from '../../backend/src/config/env.js'
import { createDatabasePool } from '../../backend/src/db/pool.js'

test('真实 MySQL 支撑商品、Session、登录购物车和订单页面流程', async ({ page }) => {
  const suffix = `${Date.now()}_${process.pid}`
  const username = `browser_${suffix}`
  const email = `${username}@example.test`
  const password = 'browser-password-123'
  const pool = createDatabasePool(readConfig().database)
  let userId
  let originalStock

  try {
    const [productRows] = await pool.query("SELECT stock FROM products WHERE id = 'notebook'")
    originalStock = Number(productRows[0].stock)
    await page.goto('/')
    await expect(page.locator('.product-card')).toHaveCount(12)

    await page.goto('/register')
    await page.getByRole('textbox', { name: /^用户名/ }).fill(username)
    await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email)
    await page.getByLabel(/^密码/).fill(password)
    await page.getByRole('button', { name: '创建账号', exact: true }).click()
    await expect(page.getByText(username, { exact: true })).toBeVisible()
    const [userRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    userId = userRows[0].id

    await page.getByRole('button', { name: '将原野 · 布面笔记本加入购物车', exact: true }).click()
    await expect(page.getByRole('link', { name: '购物车，1 件商品', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '购物车，1 件商品', exact: true }).click()
    await expect(page.getByTestId('cart-total')).toHaveText('¥28.00')

    await page.reload()
    await expect(page.getByText(username, { exact: true })).toBeVisible()
    await expect(page.getByTestId('cart-total')).toHaveText('¥28.00')

    await page.getByRole('button', { name: '退出', exact: true }).click()
    await page.goto('/login')
    await page.getByRole('textbox', { name: '用户名或邮箱' }).fill(username)
    await page.getByLabel('密码', { exact: true }).fill(password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.getByRole('link', { name: '购物车，1 件商品', exact: true })).toBeVisible()

    await page.getByRole('link', { name: '购物车，1 件商品', exact: true }).click()
    await page.getByRole('button', { name: '确认下单', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/\d+$/)
    const orderId = page.url().split('/').pop()
    await expect(page.getByRole('heading', { name: `订单 #${orderId}` })).toBeVisible()
    await expect(page.getByTestId('order-total')).toHaveText('¥28.00')
    await expect(page.getByText('placed', { exact: true })).toBeVisible()

    const [databaseOrders] = await pool.execute(`
      SELECT o.status, o.total_amount_cents AS totalAmountCents,
             oi.unit_price_cents AS unitPriceCents
      FROM orders AS o
      INNER JOIN order_items AS oi ON oi.order_id = o.id
      WHERE o.id = ? AND o.user_id = ?
    `, [orderId, userId])
    assert.equal(databaseOrders[0].status, 'placed')
    assert.equal(Number(databaseOrders[0].totalAmountCents), 2800)
    assert.equal(Number(databaseOrders[0].unitPriceCents), 2800)

    await page.getByRole('link', { name: '返回订单记录', exact: true }).click()
    await expect(page.locator(`[data-order-id="${orderId}"]`)).toBeVisible()
    await expect(page.getByRole('link', { name: '购物车，0 件商品', exact: true })).toBeVisible()
  } finally {
    try {
      if (originalStock !== undefined) {
        await pool.execute("UPDATE products SET stock = ? WHERE id = 'notebook'", [originalStock])
      }
    } finally {
      try {
        if (userId) {
          await pool.execute(`
            DELETE oi
            FROM order_items AS oi
            INNER JOIN orders AS o ON o.id = oi.order_id
            WHERE o.user_id = ?
          `, [userId])
          await pool.execute('DELETE FROM orders WHERE user_id = ?', [userId])
        }
        await pool.execute('DELETE FROM users WHERE email = ?', [email])
      } finally {
        await pool.end()
      }
    }
  }
})
