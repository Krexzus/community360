import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSession,
  deleteSession,
  getCookieToken,
  getSession,
  hashPassword,
  verifyPassword,
} from './auth.js'

test('password hashes verify the password without storing it as plain text', async () => {
  const password = 'a-test-password-that-is-long-enough'
  const hash = await hashPassword(password)

  assert.notEqual(hash, password)
  assert.match(hash, /^scrypt\$16384\$8\$1\$/)
  assert.equal(await verifyPassword(password, hash), true)
  assert.equal(await verifyPassword('a-different-password', hash), false)
})

test('session tokens are read from the cookie and can be revoked', () => {
  const user = {
    id: 1,
    username: 'test-admin',
    email: 'test-admin@example.invalid',
    role: 'admin' as const,
  }
  const session = createSession(user)

  assert.equal(getCookieToken(`community360_session=${session.token}`), session.token)
  assert.deepEqual(getSession(session.token), user)

  deleteSession(session.token)
  assert.equal(getSession(session.token), null)
})
