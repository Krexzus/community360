import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardSnapshot } from '../lib/dashboard-client'
import { formatDate, formatNumber, formatShortDate } from '../lib/format'

type Props = {
  data: DashboardSnapshot['dailyInteractions']
}

export default function RechartsView({ data }: Props) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 0, left: -16 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--line-soft)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
            dy={8}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
            width={38}
          />
          <Tooltip
            cursor={{ fill: 'var(--teal-wash)' }}
            contentStyle={{
              border: '1px solid var(--ink)',
              borderRadius: 0,
              background: 'var(--paper)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
            }}
            formatter={(value) => [
              `${formatNumber(Number(value))} interacciones`,
              'Total',
            ]}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Bar
            dataKey="count"
            name="Interacciones"
            fill="var(--teal)"
            radius={[2, 2, 0, 0]}
            maxBarSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
