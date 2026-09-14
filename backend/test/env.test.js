import assert from 'node:assert/strict'
import test from 'node:test'
import { readConfig } from '../src/config/env.js'

test('uses loopback development defaults', () => {
  const config = readConfig({})
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 3000)
  assert.equal(config.database.host, '127.0.0.1')
  assert.equal(config.database.port, 3306)
  assert.equal(config.database.database, 'ecommerce')
  assert.equal(config.database.user, 'ecommerce_app')
})

test('requires production credentials by variable name', () => {
  assert.throws(
    () => readConfig({ NODE_ENV: 'production' }),
    /DB_PASSWORD is required in production/,
  )
  assert.throws(
    () => readConfig({ NODE_ENV: 'production', DB_PASSWORD: 'test-password' }),
    /ORIGIN_PROXY_SECRET is required in production/,
  )
})

test('rejects a public production bind address', () => {
  assert.throws(
    () => readConfig({ NODE_ENV: 'production', HOST: '0.0.0.0' }),
    /HOST must be 127\.0\.0\.1 in production/,
  )
})
