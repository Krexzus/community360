export type CountByLabel = {
  label: string
  count: number
}

export type DashboardSnapshot = {
  generatedAt: string
  usersRegistered: number
  validInteractions: number
  quarantinedInteractions: number
  dailyInteractions: Array<{ date: string; count: number }>
  interactionsByChannel: CountByLabel[]
  interactionsByType: CountByLabel[]
  usersByStatus: CountByLabel[]
  sentimentByTopic: Array<{ label: string; count: number; averageSentiment: number }>
  activityByHour: Array<{ day: number; hour: number; count: number }>
  consentedLocations: Array<{
    country: string
    state: string
    city: string
    count: number
  }>
  etl: {
    status: 'success' | 'unknown'
    lastRunAt: string | null
  }
}

export type SnapshotResult =
  | { state: 'not-configured'; snapshot: null; message: string }
  | { state: 'loading'; snapshot: null; message: null }
  | { state: 'ready'; snapshot: DashboardSnapshot; message: null }
  | { state: 'error'; snapshot: null; message: string }

const apiBaseUrl = import.meta.env.PROD
  ? ''
  : import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')
const legacyDashboardUrl = import.meta.env.PROD
  ? ''
  : import.meta.env.VITE_DASHBOARD_URL?.trim()
const dashboardUrl = apiBaseUrl
  ? new URL('/api/dashboard/summary', apiBaseUrl).toString()
  : import.meta.env.PROD
    ? '/api/dashboard/summary'
    : legacyDashboardUrl
const configuredEventsUrl = import.meta.env.PROD
  ? ''
  : import.meta.env.VITE_EVENTS_WS_URL?.trim()
const eventsUrl =
  configuredEventsUrl ||
  (apiBaseUrl
    ? new URL('/ws/events', apiBaseUrl.replace(/^http/, 'ws')).toString()
    : import.meta.env.PROD && typeof window !== 'undefined'
      ? new URL('/ws/events', window.location.href).toString().replace(/^http/, 'ws')
      : '')

export const dashboardClientConfig = {
  apiBaseUrl,
  isConfigured: Boolean(dashboardUrl),
  hasRealtime: Boolean(eventsUrl),
}

export function apiUrl(path: string): string {
  if (!apiBaseUrl) {
    if (import.meta.env.PROD) return path
    throw new Error('La conexión de datos no está configurada.')
  }
  return new URL(path, `${apiBaseUrl}/`).toString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function parseCountList(value: unknown): CountByLabel[] {
  if (!Array.isArray(value)) {
    throw new Error('El formato de distribución no es válido.')
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== 'string' ||
      item.label.trim() === '' ||
      !isNonNegativeNumber(item.count)
    ) {
      throw new Error('El formato de distribución no es válido.')
    }

    return { label: item.label, count: item.count }
  })
}

function parseDailyInteractions(value: unknown): DashboardSnapshot['dailyInteractions'] {
  if (!Array.isArray(value)) {
    throw new Error('El formato de actividad diaria no es válido.')
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      !isDateString(item.date) ||
      !isNonNegativeNumber(item.count)
    ) {
      throw new Error('El formato de actividad diaria no es válido.')
    }

    return { date: item.date, count: item.count }
  })
}

function parseSentimentByTopic(value: unknown): DashboardSnapshot['sentimentByTopic'] {
  if (!Array.isArray(value)) {
    throw new Error('El formato de sentimiento por tema no es válido.')
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== 'string' ||
      item.label.trim() === '' ||
      !isNonNegativeNumber(item.count) ||
      typeof item.averageSentiment !== 'number' ||
      !Number.isFinite(item.averageSentiment) ||
      item.averageSentiment < -1 ||
      item.averageSentiment > 1
    ) {
      throw new Error('El formato de sentimiento por tema no es válido.')
    }

    return {
      label: item.label,
      count: item.count,
      averageSentiment: item.averageSentiment,
    }
  })
}

function parseActivityByHour(value: unknown): DashboardSnapshot['activityByHour'] {
  if (!Array.isArray(value)) {
    throw new Error('El formato de actividad por hora no es válido.')
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      !Number.isInteger(item.day) ||
      Number(item.day) < 1 ||
      Number(item.day) > 7 ||
      !Number.isInteger(item.hour) ||
      Number(item.hour) < 0 ||
      Number(item.hour) > 23 ||
      !isNonNegativeNumber(item.count)
    ) {
      throw new Error('El formato de actividad por hora no es válido.')
    }

    return { day: Number(item.day), hour: Number(item.hour), count: item.count }
  })
}

function parseConsentedLocations(value: unknown): DashboardSnapshot['consentedLocations'] {
  if (!Array.isArray(value)) {
    throw new Error('El formato de ubicaciones agregadas no es válido.')
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.country !== 'string' ||
      typeof item.state !== 'string' ||
      typeof item.city !== 'string' ||
      !isNonNegativeNumber(item.count) ||
      item.count < 5
    ) {
      throw new Error('El formato de ubicaciones agregadas no es válido.')
    }

    return {
      country: item.country,
      state: item.state,
      city: item.city,
      count: item.count,
    }
  })
}

function parseSnapshot(value: unknown): DashboardSnapshot {
  if (
    !isRecord(value) ||
    !isDateString(value.generatedAt) ||
    !isNonNegativeNumber(value.usersRegistered) ||
    !isNonNegativeNumber(value.validInteractions) ||
    !isNonNegativeNumber(value.quarantinedInteractions) ||
    !isRecord(value.etl) ||
    !['success', 'unknown'].includes(String(value.etl.status)) ||
    !(value.etl.lastRunAt === null || isDateString(value.etl.lastRunAt))
  ) {
    throw new Error('Los datos recibidos tienen un formato inesperado.')
  }

  return {
    generatedAt: value.generatedAt,
    usersRegistered: value.usersRegistered,
    validInteractions: value.validInteractions,
    quarantinedInteractions: value.quarantinedInteractions,
    dailyInteractions: parseDailyInteractions(value.dailyInteractions),
    interactionsByChannel: parseCountList(value.interactionsByChannel),
    interactionsByType: parseCountList(value.interactionsByType),
    usersByStatus: parseCountList(value.usersByStatus),
    sentimentByTopic: parseSentimentByTopic(value.sentimentByTopic),
    activityByHour: parseActivityByHour(value.activityByHour),
    consentedLocations: parseConsentedLocations(value.consentedLocations),
    etl: {
      status: value.etl.status as DashboardSnapshot['etl']['status'],
      lastRunAt: value.etl.lastRunAt,
    },
  }
}

export async function fetchDashboardSnapshot(
  signal: AbortSignal,
): Promise<DashboardSnapshot> {
  if (!dashboardUrl) {
    throw new Error('La conexión de datos no está configurada.')
  }

  let response: Response
  try {
    response = await fetch(dashboardUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error('No se pudieron cargar los datos. Verifica que el servicio esté activo.')
  }

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar los datos (HTTP ${response.status}). Verifica el servicio e inténtalo de nuevo.`,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('El servicio devolvió datos que no se pueden leer. Inténtalo de nuevo.')
  }

  return parseSnapshot(payload)
}

export function connectToEvents(
  onConnectionChange: (connected: boolean) => void,
  onInteraction: () => void,
  onProtocolError: () => void,
): () => void {
  if (!eventsUrl) {
    onConnectionChange(false)
    return () => undefined
  }

  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  let retryDelay = 1000

  const connect = () => {
    if (stopped) return

    try {
      socket = new WebSocket(eventsUrl)
    } catch {
      onConnectionChange(false)
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      retryDelay = 1000
      onConnectionChange(true)
    })
    socket.addEventListener('close', () => {
      onConnectionChange(false)
      scheduleReconnect()
    })
    socket.addEventListener('error', () => onConnectionChange(false))
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const payload: unknown = JSON.parse(event.data)
        if (
          isRecord(payload) &&
          ['interaction.created', 'interaction.updated', 'interaction.deleted'].includes(
            String(payload.type),
          )
        ) {
          onInteraction()
        }
      } catch {
        onProtocolError()
      }
    })
  }

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 2, 15_000)
  }

  connect()

  return () => {
    stopped = true
    if (retryTimer) clearTimeout(retryTimer)
    socket?.close()
  }
}
