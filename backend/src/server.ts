import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { app } from './app.js'
import { getCookieToken, getSession } from './auth.js'
import { config } from './config.js'
import { pool } from './database.js'
import { registerEventClient } from './events.js'

const server = createServer(app)
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 })

server.on('upgrade', (request, socket, head) => {
  socket.on('error', () => undefined)

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (requestUrl.pathname !== '/ws/events') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    return
  }

  const origin = request.headers.origin
  if (!origin || !config.allowedOrigins.has(origin)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    return
  }

  const user = getSession(getCookieToken(request.headers.cookie))
  if (!user) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    return
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    registerEventClient(client)
    client.send(JSON.stringify({ type: 'connected', role: user.role }))
  })
})

server.listen(config.port, config.host, () => {
  console.log(`[api] Escuchando en http://${config.host}:${config.port}`)
})

server.on('error', (error) => {
  console.error('[api] No se pudo iniciar el servidor:', error.message)
  process.exitCode = 1
})

async function shutdown() {
  webSocketServer.close()
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
