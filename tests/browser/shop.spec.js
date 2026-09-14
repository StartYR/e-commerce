import { test, expect } from '@playwright/test'
import { apiCategories, apiProducts } from '../fixtures/catalog.js'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } }),
  }))
  await page.route('**/api/cart', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cart: { items: [] } }),
  }))
  await page.route('**/api/products', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: apiProducts }),
  }))
  await page.route('**/api/categories', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ categories: apiCategories }),
  }))
})

test('商品展示、分类搜索、排序与空结果', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle('拾页 · 文具小店')
  await expect(page.locator('.product-card')).toHaveCount(12)
  await page.screenshot({ path: testInfo.outputPath('storefront.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: '挑选好物', exact: true }).click()
  await expect(page.getByRole('heading', { name: /桌面上的小确幸/ })).toBeFocused()
  await page.getByRole('button', { name: '书写工具', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(3)
  await page.getByRole('combobox', { name: '商品排序' }).selectOption('price-asc')
  await expect(page.locator('.product-card').first()).toHaveAttribute('data-product-id', 'pencils')
  await page.getByRole('combobox', { name: '商品排序' }).selectOption('price-desc')
  await expect(page.locator('.product-card').first()).toHaveAttribute('data-product-id', 'highlighters')
  await page.getByRole('searchbox', { name: '搜索商品' }).fill('  中性笔  ')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: '纸本手帐', exact: true }).click()
  await expect(page.getByText('还没找到这件好物')).toBeVisible()
  await page.getByRole('button', { name: '查看全部好物' }).click()
  await expect(page.locator('.product-card')).toHaveCount(12)
  expect(errors).toEqual([])
})

test('商品业务字段来自同源商品 API', async ({ page }) => {
  await page.unroute('**/api/products')
  await page.route('**/api/products', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      products: apiProducts.map((product) => product.id === 'notebook'
        ? {
            ...product,
            name: '数据库 · 动态笔记本',
            description: '此名称、描述、价格和库存来自 API',
            priceCents: 4321,
            stock: 0,
            categoryId: 'desk',
            categoryName: '桌面小物',
          }
        : product),
    }),
  }))

  await page.goto('/')
  const card = page.locator('[data-product-id="notebook"]')
  await expect(card.getByRole('heading')).toHaveText('数据库 · 动态笔记本')
  await expect(card).toContainText('此名称、描述、价格和库存来自 API')
  await expect(card).toContainText('¥43.21')
  await expect(card.getByRole('button', { name: '数据库 · 动态笔记本暂时售罄' })).toBeDisabled()
  await page.getByRole('button', { name: '桌面小物', exact: true }).click()
  await expect(card).toBeVisible()
})

test('添加、合并、修改数量、金额计算、刷新恢复与删除', async ({ page }, testInfo) => {
  await page.goto('/')
  const addNotebook = page.getByRole('button', { name: '将原野 · 布面笔记本加入购物车', exact: true })
  await addNotebook.click()
  await addNotebook.click()
  await page.getByRole('button', { name: '将日常 · 双色中性笔加入购物车', exact: true }).click()
  await page.getByRole('link', { name: '购物车，3 件商品', exact: true }).click()
  await expect(page).toHaveTitle('我的购物车 · 拾页')
  await expect(page.locator('.cart-row')).toHaveCount(2)
  await expect(page.getByTestId('cart-total')).toHaveText('¥68.00')
  const quantity = page.getByRole('spinbutton', { name: '原野 · 布面笔记本数量', exact: true })
  await expect(quantity).toHaveValue('2')
  await page.getByRole('button', { name: '增加原野 · 布面笔记本数量', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('¥96.00')
  await page.reload()
  await expect(quantity).toHaveValue('3')
  await expect(page.getByTestId('cart-total')).toHaveText('¥96.00')
  await page.screenshot({ path: testInfo.outputPath('cart.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await quantity.fill('0')
  await quantity.blur()
  await expect(quantity).toHaveValue('1')
  await expect(page.getByRole('button', { name: '减少原野 · 布面笔记本数量', exact: true })).toBeDisabled()
  await quantity.fill('100')
  await quantity.blur()
  await expect(quantity).toHaveValue('99')
  await expect(page.getByRole('button', { name: '增加原野 · 布面笔记本数量', exact: true })).toBeDisabled()
  await quantity.fill('2')
  await quantity.blur()
  await page.getByRole('button', { name: '移除日常 · 双色中性笔', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('¥56.00')
  await page.getByRole('button', { name: '移除原野 · 布面笔记本', exact: true }).click()
  await expect(page.getByRole('heading', { name: '购物车还空着呢' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '购物车还空着呢' })).toBeVisible()
  await page.getByRole('link', { name: '去逛逛小店', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(12)
})

test('损坏的购物车数据可恢复，路由可直接刷新', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('shiye-cart-v1', '{broken'))
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: '购物车还空着呢' })).toBeVisible()
  await page.getByRole('link', { name: '去逛逛小店', exact: true }).click()
  await page.getByRole('button', { name: '将原野 · 布面笔记本加入购物车', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('shiye-cart-v1')).items)).toEqual([{ productId: 'notebook', quantity: 1 }])
})

test('浏览器拒绝保存时仍可操作并说明限制', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError') }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '将原野 · 布面笔记本加入购物车', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('浏览器暂时无法保存购物车')
  await page.getByRole('link', { name: '购物车，1 件商品', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('¥28.00')
})

test('键盘跳过导航时保持当前页面', async ({ page }) => {
  await page.goto('/cart')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '跳到主要内容', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByRole('heading', { name: '购物车还空着呢' })).toBeVisible()
})

test('注册使用同源 API 并在成功后更新账户状态', async ({ page }) => {
  let requestBody
  await page.route('**/api/auth/register', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: '1', username: 'reader_1', email: 'reader@example.com' } }),
    })
  })

  await page.goto('/register')
  await page.getByRole('textbox', { name: /^用户名/ }).fill('reader_1')
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('reader@example.com')
  await page.getByLabel(/^密码/).fill('password123')
  await page.getByRole('button', { name: '创建账号', exact: true }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('reader_1', { exact: true })).toBeVisible()
  expect(requestBody).toEqual({ username: 'reader_1', email: 'reader@example.com', password: 'password123' })
})

test('登录和退出都使用同源 Session API', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: '1', username: 'reader', email: 'reader@example.com' } }),
  }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }))

  await page.goto('/login')
  await page.getByRole('textbox', { name: '用户名或邮箱' }).fill('reader')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('reader', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible()
})

test('登录用户使用数据库购物车，退出后恢复游客购物车', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('shiye-cart-v1', JSON.stringify({
    version: 1,
    items: [{ productId: 'gel-pens', quantity: 1 }],
  })))
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: '1', username: 'reader', email: 'reader@example.com' } }),
  }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }))
  await page.unroute('**/api/cart')

  let quantity = 2
  const databaseCart = () => ({
    cart: {
      items: [{
        productId: 'notebook',
        quantity,
        name: '原野 · 布面笔记本',
        description: 'A5 / 横线内页 / 160 页',
        priceCents: 2800,
        stock: 68,
        isActive: true,
        categoryId: 'paper',
        categoryName: '纸本手帐',
      }],
    },
  })
  await page.route('**/api/cart', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(databaseCart()),
  }))
  await page.route('**/api/cart/items/notebook', async (route) => {
    quantity = route.request().postDataJSON().quantity
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(databaseCart()),
    })
  })

  await page.goto('/login')
  await page.getByRole('textbox', { name: '用户名或邮箱' }).fill('reader')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('link', { name: '购物车，2 件商品', exact: true })).toBeVisible()

  await page.getByRole('link', { name: '购物车，2 件商品', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('¥56.00')
  await page.getByRole('button', { name: '增加原野 · 布面笔记本数量', exact: true }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('¥84.00')

  await page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(page.getByRole('link', { name: '购物车，1 件商品', exact: true })).toBeVisible()
  await expect(page.getByTestId('cart-total')).toHaveText('¥12.00')
})

test('登录用户可以确认下单并查看订单详情与历史', async ({ page }) => {
  const order = {
    id: '27',
    totalAmountCents: 5600,
    status: 'placed',
    createdAt: '2026-09-14T01:00:00.000Z',
    items: [{
      productId: 'notebook',
      quantity: 2,
      unitPriceCents: 2800,
      name: '原野 · 布面笔记本',
      description: 'A5 / 横线内页 / 160 页',
    }],
  }
  let cartCleared = false

  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: '1', username: 'reader', email: 'reader@example.com' } }),
  }))
  await page.unroute('**/api/cart')
  await page.route('**/api/cart', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      cart: {
        items: cartCleared ? [] : [{
          productId: 'notebook',
          quantity: 2,
          name: '原野 · 布面笔记本',
          description: 'A5 / 横线内页 / 160 页',
          priceCents: 2800,
          stock: 68,
          isActive: true,
          categoryId: 'paper',
          categoryName: '纸本手帐',
        }],
      },
    }),
  }))
  await page.route('**/api/orders/27', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ order }),
  }))
  await page.route('**/api/orders', (route) => {
    if (route.request().method() === 'POST') {
      cartCleared = true
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ order }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [order] }),
    })
  })

  await page.goto('/login')
  await page.getByRole('textbox', { name: '用户名或邮箱' }).fill('reader')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('link', { name: '购物车，2 件商品', exact: true })).toBeVisible()

  await page.getByRole('link', { name: '购物车，2 件商品', exact: true }).click()
  await page.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/27$/)
  await expect(page.getByRole('heading', { name: '订单 #27' })).toBeVisible()
  await expect(page.getByTestId('order-total')).toHaveText('¥56.00')
  await expect(page.getByText('placed', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: '返回订单记录', exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await expect(page.locator('[data-order-id="27"]')).toContainText('¥56.00')
  await expect(page.getByRole('link', { name: '购物车，0 件商品', exact: true })).toBeVisible()
})
