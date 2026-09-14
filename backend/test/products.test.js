import assert from 'node:assert/strict'
import test from 'node:test'
import { createProductService } from '../src/services/products.js'

test('product lookup uses a placeholder and keeps the stable product id as a parameter', async () => {
  const calls = []
  const pool = {
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      return [[{
        id: 'notebook',
        name: 'Notebook',
        description: 'Description',
        priceCents: 2800,
        stock: 68,
        isActive: 1,
        categoryId: 'paper',
        categoryName: 'Paper',
      }]]
    },
  }

  const product = await createProductService(pool).getProduct('notebook')
  assert.match(calls[0].sql, /p\.id = \?/)
  assert.deepEqual(calls[0].parameters, ['notebook'])
  assert.equal(product.isActive, true)
})

test('product list joins categories and exposes only active products', async () => {
  let query
  const pool = {
    query: async (sql) => {
      query = sql
      return [[], []]
    },
  }

  assert.deepEqual(await createProductService(pool).listProducts(), [])
  assert.match(query, /INNER JOIN categories/)
  assert.match(query, /p\.is_active = TRUE/)
})
