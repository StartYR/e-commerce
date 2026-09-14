import mysql from 'mysql2/promise'

export function createDatabasePool(databaseConfig) {
  return mysql.createPool({
    ...databaseConfig,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
  })
}
