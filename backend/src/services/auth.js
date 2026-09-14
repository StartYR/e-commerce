import { HttpError } from '../middleware/errors.js'
import { publicUser } from './users.js'

function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!/^[\p{L}\p{N}_-]{3,50}$/u.test(username)) {
    throw new HttpError(400, 'INVALID_USERNAME', 'Username must be 3-50 letters, numbers, underscores, or hyphens')
  }
  return username
}

function validateEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Email address is invalid')
  }
  return email
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password must be 8-128 characters')
  }
  return value
}

export function createAuthService({ userService, sessionService, passwordService }) {
  return {
    async register(input = {}) {
      const username = validateUsername(input.username)
      const email = validateEmail(input.email)
      const password = validatePassword(input.password)
      const passwordHash = await passwordService.hash(password)

      let user
      try {
        user = await userService.create({ username, email, passwordHash })
      } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
          throw new HttpError(409, 'ACCOUNT_EXISTS', 'Username or email is already registered')
        }
        throw error
      }

      const session = await sessionService.create(user.id)
      return { user, ...session }
    },

    async login(input = {}) {
      const login = typeof input.login === 'string' ? input.login.trim().toLocaleLowerCase('en-US') : ''
      const password = validatePassword(input.password)
      if (!login) throw new HttpError(400, 'INVALID_LOGIN', 'Username or email is required')

      const user = await userService.findForLogin(login)
      const passwordMatches = user
        ? await passwordService.verify(password, user.passwordHash)
        : await passwordService.verifyDummy(password)
      if (!passwordMatches) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Username/email or password is incorrect')
      }

      const session = await sessionService.create(user.id)
      return { user: publicUser(user), ...session }
    },

    findSessionUser(token) {
      return sessionService.findUser(token)
    },

    removeSession(token) {
      return sessionService.remove(token)
    },
  }
}
