import { pool } from './database.js'
import { hashPassword } from './auth.js'

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Ejecuta este comando desde una terminal interactiva de VS Code.')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = (error?: Error) => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('Operación cancelada.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u0008' || character === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        if (character >= ' ') {
          value += character
          process.stdout.write('*')
        }
      }
    }

    process.stdout.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

async function main(): Promise<void> {
  const [usernameInput, emailInput] = process.argv.slice(2)
  if (!usernameInput || !emailInput || process.argv.length > 4) {
    throw new Error(
      'Uso: npm run create-admin -- <usuario> <correo>',
    )
  }

  const username = usernameInput.trim()
  const email = emailInput.trim().toLowerCase()
  if (!/^[\p{L}\p{N}._-]{3,50}$/u.test(username)) {
    throw new Error('El usuario debe tener de 3 a 50 letras, números, punto, guion o guion bajo.')
  }
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo no tiene un formato válido.')
  }

  const password = await readHidden('Nueva contraseña (mínimo 14 caracteres): ')
  const confirmation = await readHidden('Confirma la nueva contraseña: ')
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')

  const passwordHash = await hashPassword(password)
  try {
    await pool.query(
      `INSERT INTO usuarios_sistema (usuario, email, password_hash, rol)
       VALUES ($1, $2, $3, 'admin')`,
      [username, email, passwordHash],
    )
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : ''
    if (code === '23505') {
      throw new Error('Ya existe una cuenta con ese usuario o correo; no se modificó.')
    }
    throw new Error('No fue posible crear la cuenta en Aiven.')
  }

  console.log('Cuenta admin creada. Inicia sesión con el usuario o correo indicado.')
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Error al crear la cuenta.')
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
