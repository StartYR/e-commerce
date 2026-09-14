import assert from 'node:assert/strict'
import test from 'node:test'
import { createPasswordService } from '../src/services/passwords.js'

test('hashes passwords with Argon2id and verifies without storing plaintext', async () => {
  const service = createPasswordService()
  const hash = await service.hash('password123')
  assert.match(hash, /^\$argon2id\$v=19\$/)
  assert.match(hash, /m=19456/)
  assert.match(hash, /t=2/)
  assert.match(hash, /p=1/)
  assert.notEqual(hash, 'password123')
  assert.equal(await service.verify('password123', hash), true)
  assert.equal(await service.verify('different-password', hash), false)
})
