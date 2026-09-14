import { HttpError } from '../middleware/errors.js'

const CART_COLUMNS = `
  ci.product_id AS productId,
  ci.quantity,
  p.name,
  p.description,
  p.price_cents AS priceCents,
  p.stock,
  p.is_active AS isActive,
  c.id AS categoryId,
  c.name AS categoryName
`

function normalizeCart(rows) {
  return {
    items: rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) })),
  }
}

async function readCart(executor, userId) {
  const [rows] = await executor.execute(`
    SELECT ${CART_COLUMNS}
    FROM carts AS cart
    INNER JOIN cart_items AS ci ON ci.cart_id = cart.id
    INNER JOIN products AS p ON p.id = ci.product_id
    INNER JOIN categories AS c ON c.id = p.category_id
    WHERE cart.user_id = ?
    ORDER BY ci.product_id
  `, [userId])
  return normalizeCart(rows)
}

function validateProductId(productId) {
  if (typeof productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(productId)) {
    throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  }
}

function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new HttpError(400, 'INVALID_QUANTITY', 'Quantity must be an integer between 1 and 99')
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

export function createCartService(pool) {
  return {
    get(userId) {
      return readCart(pool, userId)
    },

    async setItem(userId, productId, quantity) {
      validateProductId(productId)
      validateQuantity(quantity)

      return inTransaction(pool, async (connection) => {
        const [products] = await connection.execute(`
          SELECT id
          FROM products
          WHERE id = ? AND is_active = TRUE
          LIMIT 1
        `, [productId])
        if (!products[0]) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found')

        await connection.execute(`
          INSERT INTO carts (user_id)
          VALUES (?)
          ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        `, [userId])
        const [carts] = await connection.execute(`
          SELECT id
          FROM carts
          WHERE user_id = ?
          LIMIT 1
        `, [userId])

        await connection.execute(`
          INSERT INTO cart_items (cart_id, product_id, quantity)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE quantity = ?
        `, [carts[0].id, productId, quantity, quantity])
        await connection.execute(`
          UPDATE carts
          SET updated_at = CURRENT_TIMESTAMP(6)
          WHERE id = ?
        `, [carts[0].id])

        return readCart(connection, userId)
      })
    },

    async removeItem(userId, productId) {
      validateProductId(productId)

      return inTransaction(pool, async (connection) => {
        const [carts] = await connection.execute(`
          SELECT id
          FROM carts
          WHERE user_id = ?
          LIMIT 1
        `, [userId])
        if (carts[0]) {
          await connection.execute(`
            DELETE FROM cart_items
            WHERE cart_id = ? AND product_id = ?
          `, [carts[0].id, productId])
          await connection.execute(`
            UPDATE carts
            SET updated_at = CURRENT_TIMESTAMP(6)
            WHERE id = ?
          `, [carts[0].id])
        }

        return readCart(connection, userId)
      })
    },
  }
}
