'use strict'

const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const backendDirectory = path.resolve(__dirname, '..', 'backend')
const serverPath = path.join(backendDirectory, 'dist', 'server.js')

if (!existsSync(serverPath)) {
  console.error('Falta backend/dist/server.js. Ejecuta "npm run build" antes de "npm start".')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['dist/server.js'], {
  cwd: backendDirectory,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) {
  console.error('No se pudo iniciar el backend compilado:', result.error.message)
  process.exitCode = 1
} else if (result.signal) {
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
