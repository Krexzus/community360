import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  CircleHelp,
  Database,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useDashboard } from './hooks/useDashboard'
import { fetchCurrentUser, signOut, type AuthUser } from './lib/auth-client'
import {
  formatDate,
  formatLabel,
  formatNumber,
  formatPercentage,
} from './lib/format'
import type { CountByLabel } from './lib/dashboard-client'
import SignIn from './components/SignIn'

const ActivityChart = lazy(() => import('./components/ActivityChart'))
const CommunityAnalytics = lazy(() => import('./components/CommunityAnalytics'))

const navigation = [
  { href: '#resumen', label: 'Resumen', tab: 'A', color: 'yellow', icon: Activity },
  { href: '#actividad', label: 'Actividad', tab: 'B', color: 'orange', icon: ArrowUpRight },
  { href: '#comunidad', label: 'Comunidad', tab: 'C', color: 'teal', icon: Users },
  { href: '#calidad', label: 'Calidad de datos', tab: 'D', color: 'green', icon: Database },
  { href: '#privacidad', label: 'Privacidad', tab: 'E', color: 'violet', icon: ShieldCheck },
] as const

function ConnectionStatus({
  label,
  connected,
}: {
  label: string
  connected: boolean
}) {
  return (
    <span className={`connection-status${connected ? ' is-connected' : ''}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function MetricCell({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <article className={`metric-cell metric-cell--${color}`}>
      <div className="metric-label">
        <span className={`tab-mark tab-mark--${color}`} aria-hidden="true" />
        <h3>{label}</h3>
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}

function EmptyState({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="empty-state">
      <CircleHelp size={20} strokeWidth={1.6} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  )
}

function DistributionList({
  title,
  items,
  color,
}: {
  title: string
  items: CountByLabel[] | undefined
  color: string
}) {
  const maxCount = items?.reduce((max, item) => Math.max(max, item.count), 0) ?? 0

  return (
    <section className="distribution-section">
      <h3>{title}</h3>
      {items && items.length > 0 ? (
        <ol className="distribution-list">
          {items.map((item) => {
            const percentage = maxCount === 0 ? 0 : (item.count / maxCount) * 100
            const label = formatLabel(item.label)
            return (
              <li className="distribution-row" key={item.label}>
                <div className="distribution-copy">
                  <span>{label}</span>
                  <strong>{formatNumber(item.count)}</strong>
                </div>
                <progress
                  className={`distribution-bar distribution-bar--${color}`}
                  max={100}
                  value={percentage}
                  aria-label={`${label}: ${formatNumber(item.count)}`}
                />
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="quiet-note">No hay datos disponibles para esta distribución.</p>
      )}
    </section>
  )
}

function DashboardView({
  user,
  onSignOut,
  signOutError,
}: {
  user: AuthUser
  onSignOut: () => void
  signOutError: string | null
}) {
  const { snapshot, snapshotState, snapshotMessage, refresh, realtime } = useDashboard()
  const hasSnapshot = snapshotState === 'ready' && snapshot !== null
  const totalReviewed = hasSnapshot
    ? snapshot.validInteractions + snapshot.quarantinedInteractions
    : 0
  const quarantineRate =
    hasSnapshot && totalReviewed > 0
      ? formatPercentage((snapshot.quarantinedInteractions / totalReviewed) * 100)
      : '—'
  const dailyRows = snapshot?.dailyInteractions ?? []

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="side-rail">
        <a className="brand-lockup" href="#resumen" aria-label="COMMUNITY 360, ir al resumen">
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">
            COMMUNITY
            <strong>360</strong>
          </span>
        </a>

        <div className="rail-rule" />
        <p className="rail-label">ÍNDICE</p>
        <nav className="section-nav" aria-label="Secciones del dashboard">
          {navigation.map(({ href, label, tab, color, icon: Icon }) => (
            <a className="nav-link" href={href} key={href}>
              <span className={`nav-tab nav-tab--${color}`}>{tab}</span>
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="rail-bottom">
          <div className="rail-rule" />
          <p>Gestión comunitaria</p>
        </div>
      </aside>

      <div className="work-area">
        <header className="topbar">
          <p className="topbar-context">
            <span className="topbar-seal" aria-hidden="true">C</span>
            <span>Panel de lectura</span>
            <span className="topbar-divider" aria-hidden="true">/</span>
            <span>Comunidad</span>
          </p>
          <div className="connection-group" role="group" aria-label="Estado de los datos">
            <ConnectionStatus
              label={
                snapshotState === 'ready'
                  ? 'Datos disponibles'
                  : snapshotState === 'not-configured'
                    ? 'Datos no configurados'
                    : snapshotState === 'loading'
                      ? 'Cargando datos'
                      : 'Error al cargar'
              }
              connected={snapshotState === 'ready'}
            />
            <ConnectionStatus
              label={
                realtime.status === 'connected'
                  ? 'Actualizaciones activas'
                  : realtime.status === 'connecting'
                    ? 'Conectando'
                    : realtime.status === 'not-configured'
                      ? 'Actualizaciones desactivadas'
                      : 'Actualizaciones pausadas'
              }
              connected={realtime.status === 'connected'}
            />
            <span className="signed-in-user">
              {user.username} · {user.role}
            </span>
            <button className="sign-out-button" type="button" onClick={onSignOut}>
              <LogOut size={15} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="dashboard" id="contenido">
          {signOutError && (
            <div className="notice notice--error" role="alert">
              <X size={17} aria-hidden="true" />
              <p>{signOutError}</p>
            </div>
          )}
          <section className="intro" id="resumen" aria-labelledby="page-title">
            <div className="intro-copy">
              <h1 id="page-title">COMMUNITY 360</h1>
              <p>
                Indicadores para entender la actividad, el bienestar y las necesidades de la
                comunidad.
              </p>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={() => void refresh()}
              disabled={snapshotState === 'loading' || snapshotState === 'not-configured'}
              aria-label={snapshotState === 'loading' ? 'Actualizando datos' : 'Actualizar datos'}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={snapshotState === 'loading' ? 'icon-spin' : undefined}
              />
              <span>{snapshotState === 'loading' ? 'Actualizando' : 'Actualizar'}</span>
            </button>
          </section>

          <section className="reading-section" aria-labelledby="reading-title">
            <div className="section-heading">
              <div>
                <h2 id="reading-title">Lectura de interacciones</h2>
              </div>
              {hasSnapshot && (
                <span className="section-note">
                  Actualizado {formatDate(snapshot.generatedAt)}
                </span>
              )}
            </div>

            <div className="metric-strip">
              <MetricCell
                label="Interacciones válidas"
                value={hasSnapshot ? formatNumber(snapshot.validInteractions) : '—'}
                detail={hasSnapshot ? 'Disponibles para consulta' : 'Sin datos disponibles'}
                color="teal"
              />
              <MetricCell
                label="En cuarentena"
                value={hasSnapshot ? formatNumber(snapshot.quarantinedInteractions) : '—'}
                detail={hasSnapshot ? 'Aisladas de la lectura válida' : 'Sin datos disponibles'}
                color="orange"
              />
              <MetricCell
                label="Tasa de cuarentena"
                value={quarantineRate}
                detail={hasSnapshot ? 'Del total de interacciones revisadas' : 'Se calculará al cargar datos'}
                color="yellow"
              />
            </div>

            {snapshotState === 'error' && (
              <div className="notice notice--error" role="status" aria-live="polite">
                <X size={17} aria-hidden="true" />
                <p>{snapshotMessage}</p>
                <button className="text-button" type="button" onClick={() => void refresh()}>
                  Reintentar
                </button>
              </div>
            )}
            {snapshotState === 'not-configured' && (
              <div className="notice notice--pending">
                <CircleHelp size={17} aria-hidden="true" />
                <p>La conexión de datos no está configurada. Revisa la configuración del proyecto.</p>
              </div>
            )}
            {snapshotState === 'loading' && (
              <p className="loading-note" role="status">
                <span className="loading-mark" aria-hidden="true" />
                Cargando datos…
              </p>
            )}
          </section>

          <section className="activity-section" id="actividad" aria-labelledby="activity-title">
            <div className="section-heading">
              <div>
                <h2 id="activity-title">Actividad por día</h2>
              </div>
            </div>

            <div className="activity-layout">
              <div className="chart-sheet">
                {hasSnapshot && dailyRows.length > 0 ? (
                  <Suspense fallback={<p className="loading-note">Preparando la gráfica…</p>}>
                    <ActivityChart data={dailyRows} />
                  </Suspense>
                ) : (
                  <EmptyState title="La actividad diaria aún no está disponible">
                    Aquí aparecerá cuando haya interacciones para mostrar.
                  </EmptyState>
                )}
              </div>

              <aside className="distribution-sheet" aria-label="Distribución de interacciones">
                <DistributionList
                  title="Por canal"
                  items={snapshot?.interactionsByChannel}
                  color="blue"
                />
                <div className="distribution-divider" />
                <DistributionList
                  title="Por tipo o tema"
                  items={snapshot?.interactionsByType}
                  color="violet"
                />
              </aside>
            </div>
          </section>

          {hasSnapshot ? (
            <Suspense fallback={<p className="loading-note">Preparando métricas comunitarias…</p>}>
              <CommunityAnalytics snapshot={snapshot} />
            </Suspense>
          ) : (
            <section className="community-section" id="comunidad" aria-labelledby="community-title">
              <div className="section-heading">
                <div><h2 id="community-title">Pulso de la comunidad</h2></div>
              </div>
              <EmptyState title="Las métricas aún no están disponibles">
                Aquí aparecerán el estatus, el sentimiento, la actividad y las ubicaciones.
              </EmptyState>
            </section>
          )}

          <section className="quality-section" id="calidad" aria-labelledby="quality-title">
            <div className="section-heading">
              <div>
                <h2 id="quality-title">Calidad de la carga</h2>
              </div>
              <span className={`etl-state${hasSnapshot && snapshot.etl.status === 'success' ? ' etl-state--ok' : ''}`}>
                {hasSnapshot && snapshot.etl.status === 'success' ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <CircleHelp size={15} aria-hidden="true" />
                )}
                {hasSnapshot
                  ? snapshot.etl.status === 'success'
                    ? 'Última carga exitosa'
                    : 'Estado no registrado'
                  : 'Sin estado de carga'}
              </span>
            </div>

            <div className="quality-ledger">
              <div className="ledger-row">
                <span className="ledger-label">
                  <Users size={16} aria-hidden="true" />
                  Usuarios registrados
                </span>
                <strong>{hasSnapshot ? formatNumber(snapshot.usersRegistered) : '—'}</strong>
              </div>
              <div className="ledger-row">
                <span className="ledger-label">
                  <Database size={16} aria-hidden="true" />
                  Interacciones revisadas
                </span>
                <strong>{hasSnapshot ? formatNumber(totalReviewed) : '—'}</strong>
              </div>
              <div className="ledger-row">
                <span className="ledger-label">
                  <RefreshCw size={16} aria-hidden="true" />
                  Última carga
                </span>
                <strong className="ledger-value">
                  {hasSnapshot && snapshot.etl.lastRunAt
                    ? formatDate(snapshot.etl.lastRunAt)
                    : 'Sin registro disponible'}
                </strong>
              </div>
            </div>
            <p className="quality-footnote">
              Los registros en cuarentena se conservan separados y no se publican como
              interacciones válidas.
            </p>
          </section>

          <section className="privacy-section" id="privacidad" aria-labelledby="privacy-title">
            <div className="privacy-heading">
              <div className="privacy-icon" aria-hidden="true">
                <LockKeyhole size={21} strokeWidth={1.7} />
              </div>
              <div>
                <h2 id="privacy-title">Ubicación con consentimiento</h2>
              </div>
            </div>
            <div className="privacy-content">
              <p>
                La ubicación solo se presenta como agregado de usuarios que dieron su
                consentimiento. El dashboard no expone domicilios, coordenadas ni ubicaciones
                individuales.
              </p>
              <ul className="privacy-list">
                <li><Check size={15} aria-hidden="true" /> Solo grupos de cinco o más usuarios</li>
                <li><Check size={15} aria-hidden="true" /> Usuarios sin consentimiento excluidos</li>
                <li><Check size={15} aria-hidden="true" /> Sin coordenadas ni ubicación individual</li>
              </ul>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetchCurrentUser(controller.signal)
      .then(setUser)
      .catch(() => {
        if (!controller.signal.aborted) setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false)
      })
    return () => controller.abort()
  }, [])

  async function handleSignOut() {
    setSignOutError(null)
    try {
      await signOut()
      setUser(null)
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'No se pudo cerrar la sesión.',
      )
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-check" role="status">
        <span className="loading-mark" aria-hidden="true" />
        Comprobando sesión…
      </main>
    )
  }

  if (!user) return <SignIn onSignedIn={setUser} />
  return (
    <DashboardView
      user={user}
      onSignOut={() => void handleSignOut()}
      signOutError={signOutError}
    />
  )
}

export default App
