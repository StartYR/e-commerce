import { expect, test } from '@playwright/test'
import { readConfig } from '../../backend/src/config/env.js'
import { createDatabasePool } from '../../backend/src/db/pool.js'

test('真实 MySQL 支撑商品、Session 和登录购物车页面流程', async ({ page }) => {
  const suffix = `${Date.now()}_${process.pid}`
  const username = `browser_${suffix}`
  const email = `${username}@example.test`
  const password = 'browser-password-123'
  const pool = createDatabasePool(readConfig().database)

  try {
    await page.goto('/')
    await expect(page.locator('.product-card')).toHaveCount(12)

    await page.goto('/register')
    await page.getByRole('textbox', { name: /^用户名/ }).fill(username)
    await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email)
    await page.getByLabel(/^密码/).fill(password)
    await page.getByRole('button', { name: '创建账号', exact: true }).click()
    await expect(page.getByText(username, { exact: true })).toBeVisible()

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
  } finally {
    await pool.execute('DELETE FROM users WHERE email = ?', [email])
    await pool.end()
  }
})
