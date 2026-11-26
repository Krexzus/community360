import type { PoolClient } from 'pg'
import { pool } from './database.js'

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

async function readSnapshot(client: PoolClient): Promise<DashboardSnapshot> {
  const countsResult = await client.query<{
    users_registered: number
    valid_interactions: number
    quarantined_interactions: number
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM usuarios) AS users_registered,
      (SELECT COUNT(*)::int FROM interacciones) AS valid_interactions,
      (SELECT COUNT(*)::int FROM interacciones_cuarentena) AS quarantined_interactions
  `)

  const dailyResult = await client.query<{ date: string; count: number }>(`
    SELECT
      TO_CHAR(DATE(fecha_hora AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count
    FROM interacciones
    GROUP BY DATE(fecha_hora AT TIME ZONE 'UTC')
    ORDER BY DATE(fecha_hora AT TIME ZONE 'UTC')
  `)

  const channelResult = await client.query<CountByLabel>(`
    SELECT canal AS label, COUNT(*)::int AS count
    FROM interacciones
    GROUP BY canal
    ORDER BY canal
  `)

  const typeResult = await client.query<CountByLabel>(`
    SELECT tipo AS label, COUNT(*)::int AS count
    FROM interacciones
    GROUP BY tipo
    ORDER BY tipo
  `)

  const statusResult = await client.query<CountByLabel>(`
    SELECT estatus AS label, COUNT(*)::int AS count
    FROM usuarios
    GROUP BY estatus
    ORDER BY CASE estatus
      WHEN 'activo' THEN 1
      WHEN 'en_riesgo' THEN 2
      WHEN 'inactivo' THEN 3
      ELSE 4
    END
  `)

  const sentimentResult = await client.query<{
    label: string
    count: number
    average_sentiment: number
  }>(`
    SELECT tema AS label, COUNT(*)::int AS count, ROUND(AVG(sentimiento), 3)::float8 AS average_sentiment
    FROM interacciones
    GROUP BY tema
    ORDER BY tema
  `)

  const activityResult = await client.query<{ day: number; hour: number; count: number }>(`
    SELECT days.day::int, hours.hour::int, COUNT(i.id_interaccion)::int AS count
    FROM generate_series(1, 7) AS days(day)
    CROSS JOIN generate_series(0, 23) AS hours(hour)
    LEFT JOIN interacciones i
      ON EXTRACT(ISODOW FROM i.fecha_hora AT TIME ZONE 'UTC') = days.day
      AND EXTRACT(HOUR FROM i.fecha_hora AT TIME ZONE 'UTC') = hours.hour
    GROUP BY days.day, hours.hour
    ORDER BY days.day, hours.hour
  `)

  const locationsResult = await client.query<{
    country: string
    state: string
    city: string
    count: number
  }>(`
    SELECT l.pais AS country, l.estado AS state, l.ciudad AS city, COUNT(*)::int AS count
    FROM ubicaciones_usuario l
    INNER JOIN usuarios u ON u.id_usuario = l.id_usuario
    WHERE u.consentimiento_datos IS TRUE
    GROUP BY l.pais, l.estado, l.ciudad
    HAVING COUNT(*) >= 5
    ORDER BY count DESC, l.pais, l.estado, l.ciudad
    LIMIT 20
  `)

  const etlResult = await client.query<{ last_run_at: Date | null }>(`
    SELECT MAX(fecha_ejecucion) AS last_run_at
    FROM bitacora_etl
  `)

  const counts = countsResult.rows[0]
  if (!counts) {
    throw new Error('La consulta de métricas no devolvió resultados.')
  }

  const lastRunAt = etlResult.rows[0]?.last_run_at ?? null

  return {
    generatedAt: new Date().toISOString(),
    usersRegistered: counts.users_registered,
    validInteractions: counts.valid_interactions,
    quarantinedInteractions: counts.quarantined_interactions,
    dailyInteractions: dailyResult.rows,
    interactionsByChannel: channelResult.rows,
    interactionsByType: typeResult.rows,
    usersByStatus: statusResult.rows,
    sentimentByTopic: sentimentResult.rows.map((row) => ({
      label: row.label,
      count: row.count,
      averageSentiment: row.average_sentiment,
    })),
    activityByHour: activityResult.rows,
    consentedLocations: locationsResult.rows,
    etl: {
      status: lastRunAt ? 'success' : 'unknown',
      lastRunAt: lastRunAt?.toISOString() ?? null,
    },
  }
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    transactionStarted = true
    const snapshot = await readSnapshot(client)
    await client.query('COMMIT')
    transactionStarted = false
    return snapshot
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch {
        console.error('[database] No se pudo revertir la transacción de lectura.')
      }
    }
    throw error
  } finally {
    client.release()
  }
}
