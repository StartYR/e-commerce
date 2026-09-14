import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from '../src/services/auth.js'

test('registration hashes the password before creating the user', async () => {
  let created
  const authService = createAuthService({
    userService: {
      create: async (input) => {
        created = input
        return { id: '1', username: input.username, email: input.email }
      },
    },
    sessionService: { create: async () => ({ token: 'token', expiresAt: new Date(0) }) },
    passwordService: { hash: async () => 'encoded-password-hash' },
  })

  await authService.register({ username: 'Reader_1', email: 'READER@example.com', password: 'password123' })
  assert.equal(created.passwordHash, 'encoded-password-hash')
  assert.notEqual(created.passwordHash, 'password123')
  assert.equal(created.email, 'reader@example.com')
})

test('unknown login performs a dummy password verification', async () => {
  let dummyChecks = 0
  const authService = createAuthService({
    userService: { findForLogin: async () => null },
    sessionService: {},
    passwordService: {
      verify: async () => true,
      verifyDummy: async () => { dummyChecks += 1; return false },
    },
  })

  await assert.rejects(
    authService.login({ login: 'missing', password: 'password123' }),
    (error) => error.status === 401 && error.code === 'INVALID_CREDENTIALS',
  )
  assert.equal(dummyChecks, 1)
})

test('duplicate registration returns one limited conflict response', async () => {
  const duplicate = new Error('duplicate detail must stay internal')
  duplicate.code = 'ER_DUP_ENTRY'
  const authService = createAuthService({
    userService: { create: async () => { throw duplicate } },
    sessionService: {},
    passwordService: { hash: async () => 'encoded-password-hash' },
  })

  await assert.rejects(
    authService.register({ username: 'reader', email: 'reader@example.com', password: 'password123' }),
    (error) => error.status === 409
      && error.code === 'ACCOUNT_EXISTS'
      && !error.message.includes('internal'),
  )
})
