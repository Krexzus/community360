import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { signIn } from '../lib/auth-client'
import type { AuthUser } from '../lib/auth-client'

type Props = {
  onSignedIn: (user: AuthUser) => void
}

export default function SignIn({ onSignedIn }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const user = await signIn(identifier.trim(), password)
      onSignedIn(user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.')
      setSubmitting(false)
    }
  }

  return (
    <main className="sign-in-screen">
      <section className="sign-in-sheet" aria-labelledby="sign-in-title">
        <a className="brand-lockup sign-in-brand" href="#inicio" aria-label="COMMUNITY 360">
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

        <div className="sign-in-heading">
          <div className="sign-in-icon" aria-hidden="true">
            <KeyRound size={20} />
          </div>
          <h1 id="sign-in-title">Iniciar sesión</h1>
          <p>Accede al panel de lectura de la comunidad.</p>
        </div>

        <form className="sign-in-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-field">
            <label htmlFor="sign-in-identifier">Usuario o correo</label>
            <input
              id="sign-in-identifier"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-describedby={error ? 'sign-in-error' : undefined}
              aria-invalid={Boolean(error)}
              disabled={submitting}
            />
          </div>

          <div className="form-field">
            <label htmlFor="sign-in-password">Contraseña</label>
            <div className="password-field">
              <input
                id="sign-in-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={error ? 'sign-in-error' : undefined}
                aria-invalid={Boolean(error)}
                disabled={submitting}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="sign-in-error" id="sign-in-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <button className="sign-in-submit" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle size={17} className="icon-spin" aria-hidden="true" />
                Verificando acceso
              </>
            ) : (
              'Entrar al dashboard'
            )}
          </button>
        </form>

      </section>
    </main>
  )
}
