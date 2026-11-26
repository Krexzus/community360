import assert from 'node:assert/strict'
import test from 'node:test'
import { readInteractionValues } from './interaction-validation.js'

const validInteraction = {
  id_interaccion: 'TEST0001',
  id_usuario: 'USR0001',
  fecha_hora: '2026-11-25T18:00:00Z',
  canal: 'Discord',
  tipo: 'reaccion',
  texto: null,
  tema: 'videojuegos',
  sentimiento: 0.25,
  idioma: 'es',
  dispositivo: 'Web',
  longitud_texto: 0,
  reacciones_recibidas: 1,
}

test('accepts a valid interaction including an expected empty reaction text', () => {
  const result = readInteractionValues(validInteraction, true)
  assert.equal(result.error, null)
  assert.equal(result.values.texto, null)
})

test('rejects geographic fields instead of persisting interaction location', () => {
  const result = readInteractionValues(
    { ...validInteraction, ciudad: 'Ciudad de prueba' },
    true,
  )
  assert.match(result.error ?? '', /Campo no permitido/)
})

test('rejects sentiment values outside the schema range', () => {
  const result = readInteractionValues(
    { ...validInteraction, sentimiento: 1.01 },
    true,
  )
  assert.match(result.error ?? '', /sentimiento debe estar entre -1 y 1/)
})

test('allows partial updates only for fields in the interaction contract', () => {
  assert.equal(readInteractionValues({ sentimiento: -1 }, false).error, null)
  assert.match(
    readInteractionValues({ pais: 'no permitido' }, false).error ?? '',
    /Campo no permitido/,
  )
})
