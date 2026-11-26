import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CSSProperties } from 'react'
import type { DashboardSnapshot } from '../lib/dashboard-client'
import { formatLabel, formatNumber } from '../lib/format'

type Props = {
  snapshot: DashboardSnapshot
}

const statusColors: Record<string, string> = {
  activo: '#52633b',
  en_riesgo: '#a44727',
  inactivo: '#3e5b89',
}
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function StatusChart({ snapshot }: Props) {
  const data = snapshot.usersByStatus.map((row) => ({
    ...row,
    name: formatLabel(row.label),
  }))

  return (
    <figure className="analytics-figure" aria-labelledby="status-heading">
      {data.length > 0 ? (
        <div className="donut-frame">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="var(--sheet)"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={statusColors[entry.label] ?? '#665374'}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatNumber(Number(value))} />
              <Legend formatter={(value) => formatLabel(String(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="quiet-note">No hay datos de estatus para mostrar.</p>
      )}
      <details className="chart-data">
        <summary>Consultar estatus como tabla</summary>
        <table>
          <caption>Usuarios por estatus</caption>
          <thead><tr><th scope="col">Estatus</th><th scope="col">Usuarios</th></tr></thead>
          <tbody>
            {snapshot.usersByStatus.map((row) => (
              <tr key={row.label}>
                <th scope="row">{formatLabel(row.label)}</th>
                <td>{formatNumber(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function SentimentChart({ snapshot }: Props) {
  const data = snapshot.sentimentByTopic.map((row) => ({
    ...row,
    topic: formatLabel(row.label),
  }))

  return (
    <figure className="analytics-figure" aria-labelledby="sentiment-heading">
      {data.length > 0 ? (
        <div className="sentiment-frame">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="var(--line-soft)" horizontal={false} />
              <XAxis
                type="number"
                domain={[-1, 1]}
                tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
              />
              <YAxis
                type="category"
                dataKey="topic"
                width={132}
                tick={{ fill: 'var(--ink-soft)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value, _name, item) => [
                  `${Number(value).toFixed(2)} · ${formatNumber(Number(item.payload.count))} interacciones`,
                  'Sentimiento promedio',
                ]}
              />
              <Bar dataKey="averageSentiment" name="Sentimiento promedio" minPointSize={2}>
                {data.map((row) => (
                  <Cell key={row.label} fill={row.averageSentiment < 0 ? '#a44727' : '#246d66'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="quiet-note">No hay interacciones para calcular sentimiento por tema.</p>
      )}
      <p className="chart-description">
        Promedio de sentimiento de las interacciones válidas; −1 es negativo y +1 positivo.
      </p>
      <details className="chart-data">
        <summary>Consultar sentimiento como tabla</summary>
        <table>
          <caption>Sentimiento promedio por tema</caption>
          <thead>
            <tr><th scope="col">Tema</th><th scope="col">Interacciones</th><th scope="col">Promedio</th></tr>
          </thead>
          <tbody>
            {snapshot.sentimentByTopic.map((row) => (
              <tr key={row.label}>
                <th scope="row">{formatLabel(row.label)}</th>
                <td>{formatNumber(row.count)}</td>
                <td>{row.averageSentiment.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function ActivityHeatmap({ snapshot }: Props) {
  const counts = new Map(
    snapshot.activityByHour.map((cell) => [`${cell.day}-${cell.hour}`, cell.count]),
  )
  const maximum = Math.max(0, ...snapshot.activityByHour.map((cell) => cell.count))

  return (
    <div
      className="heatmap-scroll"
      role="region"
      aria-labelledby="heatmap-heading"
      tabIndex={0}
    >
      <table className="activity-heatmap">
        <colgroup>
          <col className="activity-day-column" />
        </colgroup>
        <caption>
          Interacciones válidas por día de la semana y hora UTC
        </caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            {Array.from({ length: 24 }, (_, hour) => (
              <th scope="col" key={hour}>{hour}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekdays.map((dayName, index) => (
            <tr key={dayName}>
              <th scope="row">{dayName}</th>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = counts.get(`${index + 1}-${hour}`) ?? 0
                const intensity = maximum === 0 ? 0 : count / maximum
                const style = {
                  '--heat-opacity': 0.06 + intensity * 0.76,
                } as CSSProperties
                return (
                  <td key={hour} title={`${dayName}, ${hour}:00 UTC: ${formatNumber(count)}`}>
                    <span className="heatmap-cell" style={style}>
                      <span className="visually-hidden">
                        {dayName}, {hour}:00 UTC: {formatNumber(count)} interacciones
                      </span>
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-legend" aria-label="Intensidad de actividad">
        <span>Menos</span>
        {[0.08, 0.28, 0.5, 0.72, 0.9].map((opacity) => (
          <span
            className="heatmap-cell heatmap-legend-cell"
            style={{ '--heat-opacity': opacity } as CSSProperties}
            key={opacity}
            aria-hidden="true"
          />
        ))}
        <span>Más</span>
      </div>
    </div>
  )
}

export default function CommunityAnalytics({ snapshot }: Props) {
  return (
    <section className="community-section" id="comunidad" aria-labelledby="community-title">
      <div className="section-heading">
        <div>
          <h2 id="community-title">Pulso de la comunidad</h2>
        </div>
      </div>

      <div className="community-grid">
        <section className="analytics-panel" aria-labelledby="status-heading">
          <h3 id="status-heading">Estatus de usuarios</h3>
          <StatusChart snapshot={snapshot} />
        </section>

        <section className="analytics-panel" aria-labelledby="sentiment-heading">
          <h3 id="sentiment-heading">Sentimiento por tema</h3>
          <SentimentChart snapshot={snapshot} />
        </section>

        <section className="analytics-panel heatmap-panel" aria-labelledby="heatmap-heading">
          <h3 id="heatmap-heading">Actividad por día y hora</h3>
          <p className="chart-description">Cada celda muestra interacciones válidas en UTC.</p>
          <ActivityHeatmap snapshot={snapshot} />
        </section>

        <section className="analytics-panel locations-panel" aria-labelledby="locations-heading">
          <h3 id="locations-heading">Ubicaciones con consentimiento</h3>
          <p className="chart-description">
            Solo ciudades con al menos cinco usuarios que consintieron; sin coordenadas ni
            ubicaciones individuales.
          </p>
          {snapshot.consentedLocations.length > 0 ? (
            <div className="table-scroll">
              <table>
                <caption>Usuarios por ubicación agregada con consentimiento</caption>
                <thead>
                  <tr><th scope="col">Ciudad</th><th scope="col">Estado</th><th scope="col">País</th><th scope="col">Usuarios</th></tr>
                </thead>
                <tbody>
                  {snapshot.consentedLocations.map((location) => (
                    <tr key={`${location.country}-${location.state}-${location.city}`}>
                      <th scope="row">{formatLabel(location.city)}</th>
                      <td>{formatLabel(location.state)}</td>
                      <td>{formatLabel(location.country)}</td>
                      <td>{formatNumber(location.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="quiet-note">
              No hay ubicaciones consentidas que alcancen el mínimo agregado de cinco usuarios.
            </p>
          )}
        </section>
      </div>
    </section>
  )
}
