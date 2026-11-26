import { resolve } from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: resolve(process.cwd(), '..', '.env') })

const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('Falta DATABASE_URL en el archivo .env de la raíz del proyecto.')
}

let parsedDatabaseUrl: URL
try {
  parsedDatabaseUrl = new URL(databaseUrl)
} catch {
  throw new Error('DATABASE_URL no contiene una URL válida de PostgreSQL.')
}

if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
  throw new Error('DATABASE_URL debe apuntar a PostgreSQL.')
}

if (parsedDatabaseUrl.searchParams.get('sslmode') !== 'require') {
  throw new Error('La conexión a Aiven debe incluir sslmode=require.')
}

const portValue = Number(process.env.PORT ?? '8000')
if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.')
}

const host =
  process.env.HOST?.trim() ||
  (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

const allowedOrigins = (process.env.ALLOWED_ORIGINS ??
  'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS debe incluir al menos un origen permitido.')
}

export const config = {
  databaseUrl,
  host,
  port: portValue,
  allowedOrigins: new Set(allowedOrigins),
}
