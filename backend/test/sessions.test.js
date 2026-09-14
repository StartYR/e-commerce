import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionService } from '../src/services/sessions.js'

test('stores and queries only a fixed-length session token hash', async () => {
  const calls = []
  const pool = {
    execute: async (sql, parameters = []) => {
      calls.push({ sql, parameters })
      return sql.includes('SELECT u.id')
        ? [[{ id: '1', username: 'reader', email: 'reader@example.com' }], []]
        : [{}, []]
    },
  }
  const service = createSessionService(pool, { ttlDays: 7 })
  const { token } = await service.create('1')
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)

  const insert = calls.find(({ sql }) => sql.includes('INSERT INTO sessions'))
  assert.equal(insert.parameters[0], '1')
  assert.ok(Buffer.isBuffer(insert.parameters[1]))
  assert.equal(insert.parameters[1].length, 32)
  assert.notEqual(insert.parameters[1].toString('base64url'), token)

  const user = await service.findUser(token)
  assert.equal(user.username, 'reader')
  const lookup = calls.find(({ sql }) => sql.includes('SELECT u.id'))
  assert.ok(Buffer.isBuffer(lookup.parameters[0]))
  assert.equal(lookup.parameters[0].length, 32)
})
