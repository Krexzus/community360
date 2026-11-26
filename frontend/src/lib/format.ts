const numberFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
})

const shortDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
})

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatLabel(value: string): string {
  return value.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1,
  }).format(value)}%`
}

function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
}

export function formatDate(value: string): string {
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

export function formatShortDate(value: string): string {
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? value : shortDateFormatter.format(date)
}
