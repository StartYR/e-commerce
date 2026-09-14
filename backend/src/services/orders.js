import { HttpError } from '../middleware/errors.js'

const ORDER_STATUS = 'placed'

const ORDER_COLUMNS = `
  o.id,
  o.total_amount_cents AS totalAmountCents,
  o.status,
  o.created_at AS createdAt
`

const ORDER_ITEM_COLUMNS = `
  oi.order_id AS orderId,
  oi.product_id AS productId,
  oi.quantity,
  oi.unit_price_cents AS unitPriceCents,
  p.name,
  p.description
`

function normalizeOrder(row) {
  return {
    id: String(row.id),
    totalAmountCents: Number(row.totalAmountCents),
    status: row.status,
    createdAt: row.createdAt,
    items: [],
  }
}

function normalizeOrderItem(row) {
  return {
    productId: row.productId,
    quantity: Number(row.quantity),
    unitPriceCents: Number(row.unitPriceCents),
    name: row.name,
    description: row.description,
  }
}

function groupOrders(orderRows, itemRows) {
  const orders = orderRows.map(normalizeOrder)
  const byId = new Map(orders.map((order) => [order.id, order]))
  for (const row of itemRows) {
    byId.get(String(row.orderId))?.items.push(normalizeOrderItem(row))
  }
  return orders
}

async function readOrders(executor, userId, orderId = null) {
  const parameters = [userId]
  const orderFilter = orderId === null ? '' : 'AND o.id = ?'
  if (orderId !== null) parameters.push(orderId)

  const [orderRows] = await executor.execute(`
    SELECT ${ORDER_COLUMNS}
    FROM orders AS o
    WHERE o.user_id = ? ${orderFilter}
    ORDER BY o.created_at DESC, o.id DESC
  `, parameters)
  if (orderRows.length === 0) return []

  const placeholders = orderRows.map(() => '?').join(', ')
  const [itemRows] = await executor.execute(`
    SELECT ${ORDER_ITEM_COLUMNS}
    FROM order_items AS oi
    INNER JOIN products AS p ON p.id = oi.product_id
    WHERE oi.order_id IN (${placeholders})
    ORDER BY oi.order_id DESC, oi.product_id
  `, orderRows.map((row) => row.id))
  return groupOrders(orderRows, itemRows)
}

function validateOrderId(orderId) {
  if (typeof orderId !== 'string' || !/^[1-9]\d{0,19}$/.test(orderId)) {
    throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
  }
}

async function inTransaction(pool, operation) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await operation(connection)
    await connection.commit()
    return result
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // Preserve the original database or validation error.
    }
    throw error
  } finally {
    connection.release()
  }
}

export function createOrderService(pool) {
  return {
    list(userId) {
      return readOrders(pool, userId)
    },

    async get(userId, orderId) {
      validateOrderId(orderId)
      const orders = await readOrders(pool, userId, orderId)
      if (!orders[0]) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found')
      return orders[0]
    },

    create(userId) {
      return inTransaction(pool, async (connection) => {
        const [carts] = await connection.execute(`
          SELECT id
          FROM carts
          WHERE user_id = ?
          LIMIT 1
          FOR UPDATE
        `, [userId])
        if (!carts[0]) throw new HttpError(409, 'CART_EMPTY', 'Cart is empty')

        const cartId = carts[0].id
        const [items] = await connection.execute(`
          SELECT
            ci.product_id AS productId,
            ci.quantity,
            p.id AS existingProductId,
            p.price_cents AS priceCents,
            p.stock,
            p.is_active AS isActive
          FROM cart_items AS ci
          LEFT JOIN products AS p ON p.id = ci.product_id
          WHERE ci.cart_id = ?
          ORDER BY ci.product_id
          FOR UPDATE
        `, [cartId])
        if (items.length === 0) throw new HttpError(409, 'CART_EMPTY', 'Cart is empty')

        for (const item of items) {
          if (!item.existingProductId || !Boolean(item.isActive)) {
            throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'A product is unavailable')
          }
          if (Number(item.stock) < Number(item.quantity)) {
            throw new HttpError(409, 'INSUFFICIENT_STOCK', 'A product does not have enough stock')
          }
        }

        const totalAmountCents = items.reduce(
          (total, item) => total + Number(item.priceCents) * Number(item.quantity),
          0,
        )
        if (!Number.isSafeInteger(totalAmountCents)) {
          throw new Error('Order total exceeds the supported integer range')
        }

        const [orderResult] = await connection.execute(`
          INSERT INTO orders (user_id, total_amount_cents, status)
          VALUES (?, ?, ?)
        `, [userId, totalAmountCents, ORDER_STATUS])
        const orderId = String(orderResult.insertId)

        for (const item of items) {
          await connection.execute(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
            VALUES (?, ?, ?, ?)
          `, [orderId, item.productId, item.quantity, item.priceCents])

          const [stockResult] = await connection.execute(`
            UPDATE products
            SET stock = stock - ?
            WHERE id = ? AND is_active = TRUE AND stock >= ?
          `, [item.quantity, item.productId, item.quantity])
          if (stockResult.affectedRows !== 1) {
            throw new HttpError(409, 'INSUFFICIENT_STOCK', 'A product does not have enough stock')
          }
        }

        await connection.execute(`
          DELETE FROM cart_items
          WHERE cart_id = ?
        `, [cartId])
        await connection.execute(`
          UPDATE carts
          SET updated_at = CURRENT_TIMESTAMP(6)
          WHERE id = ?
        `, [cartId])

        const orders = await readOrders(connection, userId, orderId)
        return orders[0]
      })
    },
  }
}
