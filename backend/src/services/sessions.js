import { createHash, randomBytes } from 'node:crypto'
import { publicUser } from './users.js'

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function createSessionService(pool, { ttlDays }) {
  return {
    async create(userId) {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

      await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(6)')
      await pool.execute(`
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `, [userId, hashToken(token), expiresAt])

      return { token, expiresAt }
    },

    async findUser(token) {
      const [rows] = await pool.execute(`
        SELECT u.id, u.username, u.email, a.user_id IS NOT NULL AS isAdmin
        FROM sessions AS s
        INNER JOIN users AS u ON u.id = s.user_id
        LEFT JOIN admin_users AS a ON a.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(6)
        LIMIT 1
      `, [hashToken(token)])
      return publicUser(rows[0])
    },

    async remove(token) {
      await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
    },
  }
}
