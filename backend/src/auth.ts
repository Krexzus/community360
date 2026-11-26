import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'

const sessionLifetimeMs = 8 * 60 * 60 * 1000
const cookieName =
  process.env.NODE_ENV === 'production'
    ? '__Host-community360_session'
    : 'community360_session'
const dummyHash = `scrypt$16384$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`

export type SystemRole = 'admin' | 'analista'

export type AuthUser = {
  id: number
  username: string
  email: string
  role: SystemRole
}

type Session = {
  user: AuthUser
  expiresAt: number
}

const sessions = new Map<string, Session>()

function deriveKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function getCookieName(): string {
  return cookieName
}

export function getCookieToken(header: string | undefined): string | null {
  if (!header) return null

  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=')
    if (name === cookieName) {
      const token = valueParts.join('=')
      return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
    }
  }
  return null
}

export function getSession(token: string | null | undefined): Session['user'] | null {
  if (!token) return null

  const key = digestToken(token)
  const session = sessions.get(key)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key)
    return null
  }

  return session.user
}

export function createSession(user: AuthUser): {
  token: string
  maxAgeSeconds: number
} {
  const token = randomBytes(32).toString('base64url')
  sessions.set(digestToken(token), {
    user,
    expiresAt: Date.now() + sessionLifetimeMs,
  })
  return { token, maxAgeSeconds: sessionLifetimeMs / 1000 }
}

export function deleteSession(token: string | null | undefined): void {
  if (token) sessions.delete(digestToken(token))
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || Buffer.byteLength(password, 'utf8') > 1024) {
    throw new Error('La contraseña debe tener entre 14 y 1024 bytes.')
  }

  const salt = randomBytes(16)
  const derivedKey = await deriveKey(password, salt, 64)

  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`
}

export async function verifyPassword(
  password: string,
  encodedHash: string | null | undefined,
): Promise<boolean> {
  const fields = (encodedHash ?? dummyHash).split('$')
  if (
    fields.length !== 6 ||
    fields[0] !== 'scrypt' ||
    fields[1] !== '16384' ||
    fields[2] !== '8' ||
    fields[3] !== '1' ||
    !fields[4] ||
    !fields[5]
  ) {
    return false
  }

  try {
    const salt = Buffer.from(fields[4], 'base64url')
    const expected = Buffer.from(fields[5], 'base64url')
    const actual = await deriveKey(password, salt, expected.length)

    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key)
  }
}, 60_000).unref()
