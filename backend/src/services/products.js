const PRODUCT_COLUMNS = `
  p.id,
  p.name,
  p.description,
  p.price_cents AS priceCents,
  p.stock,
  p.is_active AS isActive,
  c.id AS categoryId,
  c.name AS categoryName
`

function normalizeProduct(row) {
  return { ...row, isActive: Boolean(row.isActive) }
}

export function createProductService(pool) {
  return {
    async listCategories() {
      const [rows] = await pool.query(`
        SELECT id, name
        FROM categories
        ORDER BY id
      `)
      return rows
    },

    async listProducts() {
      const [rows] = await pool.query(`
        SELECT ${PRODUCT_COLUMNS}
        FROM products AS p
        INNER JOIN categories AS c ON c.id = p.category_id
        WHERE p.is_active = TRUE
        ORDER BY p.id
      `)
      return rows.map(normalizeProduct)
    },

    async getProduct(productId) {
      const [rows] = await pool.execute(`
        SELECT ${PRODUCT_COLUMNS}
        FROM products AS p
        INNER JOIN categories AS c ON c.id = p.category_id
        WHERE p.id = ? AND p.is_active = TRUE
        LIMIT 1
      `, [productId])
      return rows[0] ? normalizeProduct(rows[0]) : null
    },
  }
}
