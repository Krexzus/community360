import { Pool } from 'pg'
import { config } from './config.js'

const connectionUrl = new URL(config.databaseUrl)
connectionUrl.searchParams.set('uselibpqcompat', 'true')

export const pool = new Pool({
  connectionString: connectionUrl.toString(),
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (error) => {
  console.error('[database] Error inesperado en una conexión inactiva:', error.name)
})
