import type { WebSocket } from 'ws'

const clients = new Set<WebSocket>()

export function registerEventClient(client: WebSocket): void {
  clients.add(client)
  client.once('close', () => clients.delete(client))
  client.once('error', () => clients.delete(client))
}

export function publishEvent(type: string): void {
  const message = JSON.stringify({ type, occurredAt: new Date().toISOString() })

  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(message)
  }
}
