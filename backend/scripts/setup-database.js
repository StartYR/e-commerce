import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2'

const loginPath = process.env.MYSQL_LOGIN_PATH || 'ecommerce-setup'
const databaseName = process.env.DB_NAME || 'ecommerce'
const applicationUser = process.env.DB_USER || 'ecommerce_app'
const applicationPassword = process.env.DB_PASSWORD

if (!/^[A-Za-z0-9_-]{1,64}$/.test(loginPath)) {
  throw new Error('MYSQL_LOGIN_PATH contains invalid characters')
}
if (!/^[A-Za-z0-9_]{1,64}$/.test(databaseName)) {
  throw new Error('DB_NAME contains invalid characters')
}
if (databaseName !== 'ecommerce') {
  throw new Error('DB_NAME must match database/schema.sql: ecommerce')
}
if (!/^[A-Za-z0-9_]{1,32}$/.test(applicationUser)) {
  throw new Error('DB_USER contains invalid characters')
}
if (applicationUser !== 'ecommerce_app') {
  throw new Error('DB_USER must be ecommerce_app')
}
if (!applicationPassword) {
  throw new Error('DB_PASSWORD is required')
}

const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url))
const seedPath = fileURLToPath(new URL('../../database/seed.sql', import.meta.url))

function runMysql(label, sql, { containsSecret = false } = {}) {
  const result = spawnSync('mysql', [
    `--login-path=${loginPath}`,
    '--default-character-set=utf8mb4',
    '--batch',
  ], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  if (result.error) throw new Error(`${label} could not start the MySQL client`)
  if (result.status !== 0) {
    if (containsSecret) throw new Error(`${label} failed; MySQL details were suppressed`)
    const detail = result.stderr.trim().replaceAll(/\r?\n/g, ' | ')
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  console.log(`${label}: ok`)
}

runMysql('schema', readFileSync(schemaPath, 'utf8'))
runMysql('seed', readFileSync(seedPath, 'utf8'))

const account = `${mysql.escape(applicationUser)}@'localhost'`
const password = mysql.escape(applicationPassword)
const escapedDatabaseName = `\`${databaseName}\``
runMysql('application account', `
  CREATE USER IF NOT EXISTS ${account} IDENTIFIED WITH caching_sha2_password BY ${password};
  ALTER USER ${account} IDENTIFIED WITH caching_sha2_password BY ${password};
  REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${account};
  GRANT SELECT, INSERT, UPDATE, DELETE ON ${escapedDatabaseName}.* TO ${account};
`, { containsSecret: true })

console.log('database setup completed')
