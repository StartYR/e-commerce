import assert from 'node:assert/strict'
import test from 'node:test'
import { createCartService } from '../src/services/cart.js'

const cartRow = {
  productId: 'notebook',
  quantity: 2,
  name: 'Notebook',
  description: 'Description',
  priceCents: 2800,
  stock: 68,
  isActive: 1,
  categoryId: 'paper',
  categoryName: 'Paper',
}

test('reads a user cart with parameterized joins', async () => {
  const calls = []
  const pool = {
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      return [[cartRow]]
    },
  }

  const cart = await createCartService(pool).get('42')
  assert.deepEqual(cart, { items: [{ ...cartRow, isActive: true }] })
  assert.match(calls[0].sql, /INNER JOIN cart_items/)
  assert.match(calls[0].sql, /cart\.user_id = \?/)
  assert.deepEqual(calls[0].parameters, ['42'])
})

test('sets an item inside a transaction and commits the resulting cart', async () => {
  const calls = []
  const events = []
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      if (sql.includes('FROM products')) return [[{ id: 'notebook' }]]
      if (sql.includes('FROM carts') && sql.includes('SELECT id')) return [[{ id: '7' }]]
      if (sql.includes('SELECT') && sql.includes('cart_items')) return [[cartRow]]
      return [{ affectedRows: 1 }]
    },
  }
  const pool = { getConnection: async () => connection }

  const cart = await createCartService(pool).setItem('42', 'notebook', 2)
  assert.deepEqual(cart, { items: [{ ...cartRow, isActive: true }] })
  assert.deepEqual(events, ['begin', 'commit', 'release'])
  const upsert = calls.find(({ sql }) => sql.includes('INSERT INTO cart_items'))
  assert.deepEqual(upsert.parameters, ['7', 'notebook', 2, 2])
})

test('rejects invalid quantities before obtaining a database connection', async () => {
  let connections = 0
  const pool = { getConnection: async () => { connections += 1 } }
  const service = createCartService(pool)

  await assert.rejects(
    service.setItem('42', 'notebook', 0),
    (error) => error.status === 400 && error.code === 'INVALID_QUANTITY',
  )
  await assert.rejects(
    service.setItem('42', 'notebook', 1.5),
    (error) => error.status === 400 && error.code === 'INVALID_QUANTITY',
  )
  assert.equal(connections, 0)
})

test('rolls back and releases the connection when a cart write fails', async () => {
  const events = []
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    execute: async (sql) => {
      if (sql.includes('FROM products')) return [[{ id: 'notebook' }]]
      throw new Error('database write failed')
    },
  }

  await assert.rejects(
    createCartService({ getConnection: async () => connection }).setItem('42', 'notebook', 2),
    /database write failed/,
  )
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('removes an item with parameters and commits the refreshed cart', async () => {
  const calls = []
  const events = []
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      if (sql.includes('FROM carts') && sql.includes('SELECT id')) return [[{ id: '7' }]]
      if (sql.includes('SELECT') && sql.includes('cart_items')) return [[]]
      return [{ affectedRows: 1 }]
    },
  }

  const cart = await createCartService({ getConnection: async () => connection })
    .removeItem('42', 'notebook')
  assert.deepEqual(cart, { items: [] })
  assert.deepEqual(events, ['begin', 'commit', 'release'])
  const deletion = calls.find(({ sql }) => sql.includes('DELETE FROM cart_items'))
  assert.deepEqual(deletion.parameters, ['7', 'notebook'])
})
