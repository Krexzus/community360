import { apiUrl } from './dashboard-client'

export type AuthUser = {
  id: number
  username: string
  email: string
  role: 'admin' | 'analista'
}

function hasAuthUser(value: unknown): value is { user: AuthUser } {
  if (typeof value !== 'object' || value === null) return false
  const user = (value as Record<string, unknown>).user
  if (typeof user !== 'object' || user === null) return false
  const record = user as Record<string, unknown>
  return (
    Number.isInteger(record.id) &&
    typeof record.username === 'string' &&
    typeof record.email === 'string' &&
    (record.role === 'admin' || record.role === 'analista')
  )
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    return fallback
  }
  return fallback
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  const response = await fetch(apiUrl('/api/auth/me'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal,
  })

  if (response.status === 401) return null
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo verificar la sesión.'))
  }

  const payload: unknown = await response.json()
  if (!hasAuthUser(payload)) throw new Error('La respuesta de sesión no es válida.')
  return payload.user
}

export async function signIn(identifier: string, password: string): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier, password }),
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo iniciar sesión.'))
  }

  const payload: unknown = await response.json()
  if (!hasAuthUser(payload)) throw new Error('La respuesta de inicio de sesión no es válida.')
  return payload.user
}

export async function signOut(): Promise<void> {
  const response = await fetch(apiUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo cerrar la sesión.'))
  }
}
