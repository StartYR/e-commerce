function publicUser(row) {
  if (!row) return null
  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
  }
}

export function createUserService(pool) {
  return {
    async create({ username, email, passwordHash }) {
      const [result] = await pool.execute(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `, [username, email, passwordHash])
      return { id: String(result.insertId), username, email }
    },

    async findForLogin(login) {
      const [rows] = await pool.execute(`
        SELECT id, username, email, password_hash AS passwordHash
        FROM users
        WHERE username = ? OR email = ?
        LIMIT 1
      `, [login, login])
      return rows[0] || null
    },

    async findPublicById(userId) {
      const [rows] = await pool.execute(`
        SELECT id, username, email
        FROM users
        WHERE id = ?
        LIMIT 1
      `, [userId])
      return publicUser(rows[0])
    },
  }
}

export { publicUser }
