import type { Request, Response } from 'express'
import { pool } from './database.js'
import { publishEvent } from './events.js'
import {
  mutableInteractionFields,
  readInteractionValues,
  type InteractionField,
} from './interaction-validation.js'

function sendDatabaseError(response: Response, error: unknown): void {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''

  if (code === '23505') {
    response.status(409).json({ error: 'Ya existe una interacción con ese identificador.' })
    return
  }
  if (code === '23503') {
    response.status(422).json({ error: 'La interacción hace referencia a un usuario inexistente.' })
    return
  }
  if (code === '23514' || code === '22P02' || code === '22003') {
    response.status(422).json({ error: 'Uno o más valores no cumplen el esquema de datos.' })
    return
  }

  console.error('[api] Error de base de datos en interacciones:', code || 'UNKNOWN')
  response.status(503).json({ error: 'No fue posible guardar los cambios en Aiven.' })
}

export async function createInteraction(request: Request, response: Response): Promise<void> {
  const { values, error } = readInteractionValues(request.body, true)
  const body = request.body as Record<string, unknown>
  if (error || typeof body.id_interaccion !== 'string') {
    response.status(400).json({ error: error ?? 'Falta id_interaccion.' })
    return
  }

  const fields = Object.keys(mutableInteractionFields) as InteractionField[]
  const params = fields.map((field) => values[field])

  try {
    await pool.query(
      `INSERT INTO interacciones (id_interaccion, ${fields.map((field) => mutableInteractionFields[field]).join(', ')})
       VALUES ($1, ${fields.map((_, index) => `$${index + 2}`).join(', ')})`,
      [body.id_interaccion, ...params],
    )
    publishEvent('interaction.created')
    response.status(201).json({ id_interaccion: body.id_interaccion })
  } catch (databaseError) {
    sendDatabaseError(response, databaseError)
  }
}

export async function updateInteraction(request: Request, response: Response): Promise<void> {
  const id = typeof request.params.id === 'string' ? request.params.id : ''
  if (!/^[A-Za-z0-9_-]{1,8}$/.test(id)) {
    response.status(400).json({ error: 'id_interaccion no tiene un formato válido.' })
    return
  }

  const { values, error } = readInteractionValues(request.body, false)
  if (error) {
    response.status(400).json({ error })
    return
  }

  const fields = Object.keys(values) as InteractionField[]
  const assignments = fields.map((field, index) => `${mutableInteractionFields[field]} = $${index + 1}`)

  try {
    const result = await pool.query(
      `UPDATE interacciones SET ${assignments.join(', ')} WHERE id_interaccion = $${fields.length + 1}`,
      [...fields.map((field) => values[field]), id],
    )
    if (result.rowCount === 0) {
      response.status(404).json({ error: 'No se encontró la interacción.' })
      return
    }
    publishEvent('interaction.updated')
    response.status(200).json({ id_interaccion: id })
  } catch (databaseError) {
    sendDatabaseError(response, databaseError)
  }
}

export async function deleteInteraction(request: Request, response: Response): Promise<void> {
  const id = typeof request.params.id === 'string' ? request.params.id : ''
  if (!/^[A-Za-z0-9_-]{1,8}$/.test(id)) {
    response.status(400).json({ error: 'id_interaccion no tiene un formato válido.' })
    return
  }

  try {
    const result = await pool.query(
      'DELETE FROM interacciones WHERE id_interaccion = $1',
      [id],
    )
    if (result.rowCount === 0) {
      response.status(404).json({ error: 'No se encontró la interacción.' })
      return
    }
    publishEvent('interaction.deleted')
    response.status(204).end()
  } catch (databaseError) {
    sendDatabaseError(response, databaseError)
  }
}
