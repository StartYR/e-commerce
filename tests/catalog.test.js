import assert from 'node:assert/strict'
import test from 'node:test'
import * as presentationModule from '../src/data/products.js'

test('商品展示映射不包含静态业务数据', () => {
  assert.equal('products' in presentationModule, false)
  for (const presentation of Object.values(presentationModule.productPresentation)) {
    for (const businessField of ['name', 'description', 'price', 'priceCents', 'category', 'categoryId', 'stock', 'isActive']) {
      assert.equal(businessField in presentation, false)
    }
  }
})

test('商品名称、价格、分类和库存完全采用 API 数据', () => {
  const product = presentationModule.presentProduct({
    id: 'notebook',
    name: '数据库商品名称',
    description: '数据库商品描述',
    priceCents: 4321,
    stock: 0,
    isActive: true,
    categoryId: 'desk',
    categoryName: '数据库分类',
  })

  assert.equal(product.name, '数据库商品名称')
  assert.equal(product.description, '数据库商品描述')
  assert.equal(product.price, 4321)
  assert.equal(product.stock, 0)
  assert.equal(product.category, 'desk')
  assert.equal(product.categoryName, '数据库分类')
  assert.equal(product.art, 'notebook')
})
