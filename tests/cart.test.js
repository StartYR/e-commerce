import test from 'node:test'
import assert from 'node:assert/strict'
import { CART_KEY, getCartTotal, normalizeQuantity, readCart, sanitizeCart } from '../src/lib/cart.js'

const products = [
  { id: 'notebook', price: 2800 },
  { id: 'gel-pens', price: 1200 },
]

test('清理非法商品编号和数量，合并重复商品并限制数量', () => {
  assert.deepEqual(sanitizeCart([
    { productId: 'notebook', quantity: 2 },
    { productId: 'notebook', quantity: 200 },
    { productId: 'missing', quantity: 2 },
    { productId: 'gel-pens', quantity: -1 },
    { productId: 'gel-pens', quantity: 1.5 },
    { productId: 'pouch', quantity: '2' },
    null,
  ]), [
    { productId: 'notebook', quantity: 99 },
    { productId: 'missing', quantity: 2 },
  ])
  assert.deepEqual(sanitizeCart({}), [])
})

test('输入的数量保持为 1 至 99 的整数', () => {
  for (const [input, expected] of [['3', 3], ['', 1], [-3, 1], [3.8, 3], [1000, 99], [NaN, 1], [Infinity, 1]]) {
    assert.equal(normalizeQuantity(input), expected)
  }
})

test('购物车只保存商品编号与数量，价格以商品目录为准', () => {
  assert.equal(getCartTotal([
    { productId: 'notebook', quantity: 3, price: 1 },
    { productId: 'gel-pens', quantity: 1 },
  ], products), 9600)
  assert.equal(getCartTotal([], products), 0)
})

test('恢复之前保存的购物车', () => {
  const storage = { getItem(key) {
    assert.equal(key, CART_KEY)
    return JSON.stringify({ version: 1, items: [{ productId: 'notebook', quantity: 2 }] })
  } }
  assert.deepEqual(readCart(storage), [{ productId: 'notebook', quantity: 2 }])
})

test('损坏、空白或未知格式的存储不会阻止页面使用', () => {
  for (const raw of [null, '{broken', 'null', '[]', '{"version":2,"items":[]}', '{"version":1,"items":null}']) {
    assert.deepEqual(readCart({ getItem: () => raw }), [])
  }
})
