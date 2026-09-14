import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}

export function createPasswordService() {
  const dummyHash = argon2.hash(randomBytes(32), ARGON2_OPTIONS)

  return {
    hash(password) {
      return argon2.hash(password, ARGON2_OPTIONS)
    },

    async verify(password, passwordHash) {
      try {
        return await argon2.verify(passwordHash, password)
      } catch {
        return false
      }
    },

    async verifyDummy(password) {
      await argon2.verify(await dummyHash, password)
      return false
    },
  }
}
