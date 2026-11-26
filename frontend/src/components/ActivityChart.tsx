import { lazy, Suspense } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import type { DashboardSnapshot } from '../lib/dashboard-client'
import { formatDate, formatNumber } from '../lib/format'

const RechartsView = lazy(() => import('./RechartsView'))

type Props = {
  data: DashboardSnapshot['dailyInteractions']
}

export default function ActivityChart({ data }: Props) {
  return (
    <figure className="activity-figure" aria-labelledby="activity-title">
      <p className="chart-description" id="chart-description">
        Interacciones válidas registradas por día.
      </p>
      <Suspense fallback={<p className="loading-note">Preparando la gráfica…</p>}>
        <RechartsView data={data} />
      </Suspense>
      <details className="chart-data">
        <summary>
          <ArrowDownToLine size={14} aria-hidden="true" />
          Consultar datos como tabla
        </summary>
        <div className="table-scroll">
          <table>
            <caption>Interacciones válidas por día</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Interacciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{formatDate(row.date)}</th>
                  <td>{formatNumber(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <figcaption className="visually-hidden">
        Actividad diaria de las interacciones válidas. La tabla expandible contiene los mismos
        valores accesibles sin depender de la gráfica.
      </figcaption>
    </figure>
  )
}
