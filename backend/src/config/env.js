const DEFAULTS = {
  HOST: '127.0.0.1',
  PORT: 3000,
  DB_HOST: '127.0.0.1',
  DB_PORT: 3306,
  DB_NAME: 'ecommerce',
  DB_USER: 'ecommerce_app',
  SESSION_COOKIE_NAME: 'shiye_session',
  SESSION_TTL_DAYS: 7,
}

function readPort(value, fallback, name) {
  const port = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`)
  }
  return port
}

function requireProductionValue(env, name) {
  if (!env[name]) throw new Error(`${name} is required in production`)
  return env[name]
}

function readPositiveInteger(value, fallback, name) {
  const result = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(result) || result < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return result
}

export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  const host = env.HOST || DEFAULTS.HOST

  if (isProduction && host !== '127.0.0.1') {
    throw new Error('HOST must be 127.0.0.1 in production')
  }

  const dbPassword = isProduction
    ? requireProductionValue(env, 'DB_PASSWORD')
    : (env.DB_PASSWORD || '')
  const originProxySecret = isProduction
    ? requireProductionValue(env, 'ORIGIN_PROXY_SECRET')
    : (env.ORIGIN_PROXY_SECRET || '')
  const sessionCookieName = env.SESSION_COOKIE_NAME || DEFAULTS.SESSION_COOKIE_NAME
  if (!/^[A-Za-z0-9_-]+$/.test(sessionCookieName)) {
    throw new Error('SESSION_COOKIE_NAME contains invalid characters')
  }

  return {
    nodeEnv,
    isProduction,
    host,
    port: readPort(env.PORT, DEFAULTS.PORT, 'PORT'),
    originProxySecret,
    session: {
      cookieName: sessionCookieName,
      ttlDays: readPositiveInteger(env.SESSION_TTL_DAYS, DEFAULTS.SESSION_TTL_DAYS, 'SESSION_TTL_DAYS'),
      secure: isProduction,
    },
    database: {
      host: env.DB_HOST || DEFAULTS.DB_HOST,
      port: readPort(env.DB_PORT, DEFAULTS.DB_PORT, 'DB_PORT'),
      database: env.DB_NAME || DEFAULTS.DB_NAME,
      user: env.DB_USER || DEFAULTS.DB_USER,
      password: dbPassword,
    },
  }
}
