import cors from 'cors'
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import helmet from 'helmet'
import {
  createSession,
  deleteSession,
  getCookieName,
  getCookieToken,
  getSession,
  verifyPassword,
  type AuthUser,
} from './auth.js'
import { config } from './config.js'
import { pool } from './database.js'
import { fetchDashboardSnapshot } from './dashboard.js'
import { createInteraction, deleteInteraction, updateInteraction } from './interactions.js'

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

export const app = express()

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '32kb' }))
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('ORIGIN_NOT_ALLOWED'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
)

function rateLimitLogin(request: Request, response: Response, next: NextFunction): void {
  const now = Date.now()
  const key = request.ip ?? 'unknown'
  const current = loginAttempts.get(key)
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 60_000 })
    next()
    return
  }
  if (current.count >= 5) {
    response.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    response.status(429).json({ error: 'Demasiados intentos. Espera un minuto e inténtalo otra vez.' })
    return
  }
  current.count += 1
  next()
}

function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const token = getCookieToken(request.headers.cookie)
  const user = getSession(token)
  if (!user) {
    response.status(401).json({ error: 'Inicia sesión para continuar.' })
    return
  }
  request.authUser = user
  next()
}

function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (request.authUser?.role !== 'admin') {
    response.status(403).json({ error: 'Se requiere el rol admin para esta operación.' })
    return
  }
  next()
}

function setSessionCookie(response: Response, token: string, maxAgeSeconds: number): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${getCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`,
  )
}

function clearSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${getCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  )
  response.setHeader('Clear-Site-Data', '"cookies"')
}

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', rateLimitLogin, async (request, response, next) => {
  const { identifier, password } = request.body ?? {}
  if (
    typeof identifier !== 'string' ||
    identifier.trim().length === 0 ||
    identifier.length > 100 ||
    typeof password !== 'string' ||
    password.length === 0 ||
    Buffer.byteLength(password, 'utf8') > 1024
  ) {
    response.status(400).json({ error: 'Escribe tu usuario y contraseña.' })
    return
  }

  try {
    const result = await pool.query<{
      id_admin: number
      usuario: string
      email: string
      password_hash: string
      rol: AuthUser['role']
    }>(
      `SELECT id_admin, usuario, email, password_hash, rol
       FROM usuarios_sistema
       WHERE LOWER(usuario) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [identifier.trim()],
    )
    const account = result.rows[0]
    const passwordMatches = await verifyPassword(password, account?.password_hash)
    if (!account || !passwordMatches) {
      response.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
      return
    }

    const user: AuthUser = {
      id: account.id_admin,
      username: account.usuario,
      email: account.email,
      role: account.rol,
    }
    const session = createSession(user)
    setSessionCookie(response, session.token, session.maxAgeSeconds)
    response.json({ user })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (request, response) => {
  deleteSession(getCookieToken(request.headers.cookie))
  clearSessionCookie(response)
  response.status(204).end()
})

app.get('/api/auth/me', requireAuth, (request, response) => {
  response.json({ user: request.authUser })
})

app.use('/api', requireAuth)

app.get('/api/dashboard/summary', async (_request, response, next) => {
  try {
    response.json(await fetchDashboardSnapshot())
  } catch (error) {
    next(error)
  }
})

app.post('/api/interactions', requireAdmin, async (request, response) => {
  await createInteraction(request, response)
})

app.patch('/api/interactions/:id', requireAdmin, async (request, response) => {
  await updateInteraction(request, response)
})

app.delete('/api/interactions/:id', requireAdmin, async (request, response) => {
  await deleteInteraction(request, response)
})

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../frontend/dist',
  )

  app.use(express.static(frontendDistPath))
  app.use((request, response, next) => {
    const isApiPath = request.path === '/api' || request.path.startsWith('/api/')
    const isWebSocketPath = request.path === '/ws' || request.path.startsWith('/ws/')
    if (request.method !== 'GET' || isApiPath || isWebSocketPath) {
      next()
      return
    }

    response.sendFile(resolve(frontendDistPath, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use((_request, response) => {
  response.status(404).json({ error: 'Ruta no encontrada.' })
})

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof Error && error.message === 'ORIGIN_NOT_ALLOWED') {
    response.status(403).json({ error: 'Origen no permitido.' })
    return
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    response.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' })
    return
  }

  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN'

  console.error('[api] Error al procesar la solicitud:', errorCode)
  response.status(503).json({
    error: 'No fue posible consultar el servicio. Revisa la conexión con Aiven.',
  })
}

app.use(errorHandler)
