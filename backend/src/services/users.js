function publicUser(row) {
  if (!row) return null
  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
    isAdmin: Number(row.isAdmin) === 1,
  }
}

export function createUserService(pool) {
  return {
    async create({ username, email, passwordHash }) {
      const [result] = await pool.execute(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `, [username, email, passwordHash])
      return publicUser({ id: result.insertId, username, email })
    },

    async findForLogin(login) {
      const [rows] = await pool.execute(`
        SELECT u.id, u.username, u.email, u.password_hash AS passwordHash,
               a.user_id IS NOT NULL AS isAdmin
        FROM users AS u
        LEFT JOIN admin_users AS a ON a.user_id = u.id
        WHERE u.username = ? OR u.email = ?
        LIMIT 1
      `, [login, login])
      return rows[0] || null
    },

    async findPublicById(userId) {
      const [rows] = await pool.execute(`
        SELECT u.id, u.username, u.email, a.user_id IS NOT NULL AS isAdmin
        FROM users AS u
        LEFT JOIN admin_users AS a ON a.user_id = u.id
        WHERE u.id = ?
        LIMIT 1
      `, [userId])
      return publicUser(rows[0])
    },
  }
}

export { publicUser }
