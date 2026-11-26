const channels = new Set([
  'Discord',
  'Facebook',
  'Instagram',
  'Telegram',
  'TikTok',
  'Twitter/X',
])
const types = new Set([
  'mensaje',
  'comentario',
  'reaccion',
  'respuesta_encuesta',
  'rsvp_evento',
])
const topics = new Set([
  'arte_comisiones',
  'eventos_convenciones',
  'fursuits',
  'memes_humor',
  'musica',
  'reglas_moderacion',
  'seguridad_privacidad',
  'videojuegos',
])
const devices = new Set(['Android', 'Escritorio', 'Web', 'iOS'])

export const mutableInteractionFields = {
  id_usuario: 'id_usuario',
  fecha_hora: 'fecha_hora',
  canal: 'canal',
  tipo: 'tipo',
  texto: 'texto',
  tema: 'tema',
  sentimiento: 'sentimiento',
  idioma: 'idioma',
  dispositivo: 'dispositivo',
  longitud_texto: 'longitud_texto',
  reacciones_recibidas: 'reacciones_recibidas',
} as const

export type InteractionField = keyof typeof mutableInteractionFields
export type InteractionValues = Partial<Record<InteractionField, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateField(field: InteractionField, value: unknown): string | null {
  if (field === 'texto') {
    return value === null || typeof value === 'string'
      ? null
      : 'texto debe ser una cadena o null.'
  }
  if (field === 'id_usuario') {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,7}$/.test(value)
      ? null
      : 'id_usuario no tiene un formato válido.'
  }
  if (field === 'fecha_hora') {
    return typeof value === 'string' &&
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
      !Number.isNaN(Date.parse(value))
      ? null
      : 'fecha_hora debe ser una fecha ISO 8601 con zona horaria.'
  }
  if (field === 'canal') {
    return typeof value === 'string' && channels.has(value)
      ? null
      : 'canal no es válido.'
  }
  if (field === 'tipo') {
    return typeof value === 'string' && types.has(value) ? null : 'tipo no es válido.'
  }
  if (field === 'tema') {
    return typeof value === 'string' && topics.has(value) ? null : 'tema no es válido.'
  }
  if (field === 'dispositivo') {
    return typeof value === 'string' && devices.has(value)
      ? null
      : 'dispositivo no es válido.'
  }
  if (field === 'sentimiento') {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= -1 &&
      value <= 1
      ? null
      : 'sentimiento debe estar entre -1 y 1.'
  }
  if (field === 'idioma') {
    return typeof value === 'string' && /^[a-zA-Z]{2}$/.test(value)
      ? null
      : 'idioma debe ser un código de dos letras.'
  }
  if (field === 'longitud_texto' || field === 'reacciones_recibidas') {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? null
      : `${field} debe ser un entero no negativo.`
  }
  return 'Campo no permitido.'
}

export function readInteractionValues(
  body: unknown,
  requireAll: boolean,
): { values: InteractionValues; error: string | null } {
  if (!isRecord(body)) return { values: {}, error: 'El cuerpo debe ser un objeto JSON.' }

  const allowed = new Set(['id_interaccion', ...Object.keys(mutableInteractionFields)])
  const unknown = Object.keys(body).find((key) => !allowed.has(key))
  if (unknown) return { values: {}, error: `Campo no permitido: ${unknown}.` }

  if (
    'id_interaccion' in body &&
    (typeof body.id_interaccion !== 'string' ||
      !/^[A-Za-z0-9_-]{1,8}$/.test(body.id_interaccion))
  ) {
    return { values: {}, error: 'id_interaccion no tiene un formato válido.' }
  }

  const fields = Object.keys(mutableInteractionFields) as InteractionField[]
  if (requireAll) {
    const missing = fields.find((field) => !(field in body))
    if (missing) return { values: {}, error: `Falta el campo obligatorio ${missing}.` }
    if (!('id_interaccion' in body)) {
      return { values: {}, error: 'Falta el campo obligatorio id_interaccion.' }
    }
  } else if (fields.every((field) => !(field in body))) {
    return { values: {}, error: 'Incluye al menos un campo para actualizar.' }
  }

  const values: InteractionValues = {}
  for (const field of fields) {
    if (!(field in body)) continue
    const error = validateField(field, body[field])
    if (error) return { values: {}, error }
    values[field] = body[field]
  }

  return { values, error: null }
}
