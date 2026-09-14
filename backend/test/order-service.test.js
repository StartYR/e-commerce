import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrderService } from '../src/services/orders.js'

const cartItem = {
  productId: 'notebook',
  quantity: 2,
  existingProductId: 'notebook',
  priceCents: 2800,
  stock: 3,
  isActive: 1,
}

const orderRow = {
  id: '11',
  totalAmountCents: 5600,
  status: 'placed',
  createdAt: new Date('2026-09-14T01:00:00.000Z'),
}

const orderItemRow = {
  orderId: '11',
  productId: 'notebook',
  quantity: 2,
  unitPriceCents: 2800,
  name: 'Notebook',
  description: 'Description',
}

function createConnection(overrides = {}) {
  const calls = []
  const events = []
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      if (sql.includes('FROM carts')) return [[{ id: '7' }]]
      if (sql.includes('FROM cart_items')) return [[cartItem]]
      if (sql.includes('INSERT INTO orders')) return [{ insertId: 11, affectedRows: 1 }]
      if (sql.includes('UPDATE products')) return [{ affectedRows: 1 }]
      if (sql.includes('FROM orders AS o')) return [[orderRow]]
      if (sql.includes('FROM order_items AS oi')) return [[orderItemRow]]
      return [{ affectedRows: 1 }]
    },
    ...overrides,
  }
  return { connection, calls, events }
}

test('creates an order, snapshots prices, decrements stock, and clears the cart in one transaction', async () => {
  const { connection, calls, events } = createConnection()
  const order = await createOrderService({ getConnection: async () => connection }).create('42')

  assert.deepEqual(order, {
    id: '11',
    totalAmountCents: 5600,
    status: 'placed',
    createdAt: orderRow.createdAt,
    items: [{
      productId: 'notebook',
      quantity: 2,
      unitPriceCents: 2800,
      name: 'Notebook',
      description: 'Description',
    }],
  })
  assert.deepEqual(events, ['begin', 'commit', 'release'])

  const cartLock = calls.find(({ sql }) => sql.includes('FROM carts'))
  const productLock = calls.find(({ sql }) => sql.includes('FROM cart_items'))
  assert.match(cartLock.sql, /FOR UPDATE/)
  assert.match(productLock.sql, /ORDER BY ci\.product_id\s+FOR UPDATE/)

  const orderInsert = calls.find(({ sql }) => sql.includes('INSERT INTO orders'))
  assert.deepEqual(orderInsert.parameters, ['42', 5600, 'placed'])
  const itemInsert = calls.find(({ sql }) => sql.includes('INSERT INTO order_items'))
  assert.deepEqual(itemInsert.parameters, ['11', 'notebook', 2, 2800])

  const stockUpdate = calls.find(({ sql }) => sql.includes('UPDATE products'))
  assert.match(stockUpdate.sql, /stock = stock - \?/)
  assert.match(stockUpdate.sql, /stock >= \?/)
  assert.deepEqual(stockUpdate.parameters, [2, 'notebook', 2])
  assert.ok(calls.some(({ sql, parameters }) => sql.includes('DELETE FROM cart_items') && parameters[0] === '7'))
})

test('rolls back when a write fails after the order row is created', async () => {
  const base = createConnection()
  const defaultExecute = base.connection.execute
  base.connection.execute = async (sql, parameters) => {
    if (sql.includes('INSERT INTO order_items')) throw new Error('order item write failed')
    return defaultExecute(sql, parameters)
  }

  await assert.rejects(
    createOrderService({ getConnection: async () => base.connection }).create('42'),
    /order item write failed/,
  )
  assert.deepEqual(base.events, ['begin', 'rollback', 'release'])
})

test('rolls back without clearing the cart when stock is insufficient', async () => {
  const { connection, calls, events } = createConnection()
  const defaultExecute = connection.execute
  connection.execute = async (sql, parameters) => {
    if (sql.includes('FROM cart_items')) return [[{ ...cartItem, stock: 1 }]]
    return defaultExecute(sql, parameters)
  }

  await assert.rejects(
    createOrderService({ getConnection: async () => connection }).create('42'),
    (error) => error.status === 409 && error.code === 'INSUFFICIENT_STOCK',
  )
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
  assert.equal(calls.some(({ sql }) => sql.includes('INSERT INTO orders')), false)
  assert.equal(calls.some(({ sql }) => sql.includes('DELETE FROM cart_items')), false)
})

test('order detail is constrained by both order id and owner id', async () => {
  const calls = []
  const pool = {
    execute: async (sql, parameters) => {
      calls.push({ sql, parameters })
      if (sql.includes('FROM orders AS o')) return [[orderRow]]
      return [[orderItemRow]]
    },
  }

  const order = await createOrderService(pool).get('42', '11')
  assert.equal(order.id, '11')
  assert.match(calls[0].sql, /o\.user_id = \? AND o\.id = \?/)
  assert.deepEqual(calls[0].parameters, ['42', '11'])
})

test('missing and invalid order ids return the same limited not-found error', async () => {
  let calls = 0
  const service = createOrderService({
    execute: async () => { calls += 1; return [[]] },
  })

  await assert.rejects(
    service.get('42', '17'),
    (error) => error.status === 404 && error.code === 'ORDER_NOT_FOUND',
  )
  await assert.rejects(
    service.get('42', 'not-an-id'),
    (error) => error.status === 404 && error.code === 'ORDER_NOT_FOUND',
  )
  assert.equal(calls, 1)
})
