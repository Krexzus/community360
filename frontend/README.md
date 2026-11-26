# COMMUNITY 360 — frontend

Dashboard en React, TypeScript, Vite, Tailwind CSS y Recharts. El cliente se
autentica contra el backend y nunca se conecta directamente a PostgreSQL/Aiven.

## Inicio local

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Abre `http://127.0.0.1:5173/`. En desarrollo, `VITE_API_BASE_URL` configura el
backend para REST y permite derivar el WebSocket. En producción, cuando frontend
y backend comparten origen, el cliente usa rutas relativas `/api/...` y deriva
`ws:`/`wss:` desde el origen actual; no requiere una URL pública incrustada en
el bundle. Las variables `VITE_*` se sustituyen durante el build y son públicas;
nunca coloques credenciales ni la cadena de conexión ahí.

## Autenticación

La aplicación pide usuario/contraseña y mantiene la sesión en una cookie
`HttpOnly`, no en `localStorage`. Usa usuario o correo; la API expira sesiones
en ocho horas y el proceso del backend las invalida al reiniciarse.

Antes del primer acceso, ejecuta una vez `sql/migracion_login_usuario.sql` en el
SQL Editor de Aiven. Después crea una cuenta administradora desde una terminal
interactiva:

```powershell
cd backend
npm run create-admin -- tu_usuario tu_correo@dominio.com
```

El comando solicita la contraseña sin mostrarla, requiere al menos 14
caracteres y solo guarda un hash scrypt. El rol `admin` puede crear, actualizar
y borrar interacciones mediante Postman. No compartas la contraseña en el chat
ni la guardes en el repositorio.

## API y eventos

- `GET /api/health`: comprueba que el servicio llega a PostgreSQL.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- `GET /api/dashboard/summary`: consulta agregados históricos; requiere sesión.
- `POST /api/interactions`: crea una interacción; requiere rol `admin`.
- `PATCH /api/interactions/:id`: modifica campos permitidos; requiere `admin`.
- `DELETE /api/interactions/:id`: borra una interacción; requiere `admin`.
- `ws://127.0.0.1:8000/ws/events`: requiere cookie de sesión y un `Origin`
  permitido. Emite `interaction.created`, `interaction.updated` o
  `interaction.deleted`; el dashboard vuelve a pedir el snapshot REST.

El backend solo acepta por defecto los orígenes locales de Vite. Configura los
orígenes permitidos en `ALLOWED_ORIGINS`, separados por comas; no uses `*`. Para
un único servicio Render que sirve ambos proyectos, configura únicamente el
origen público de Render en esa variable. En producción se requiere HTTPS/WSS,
certificado CA de Aiven y revisar el almacenamiento de sesiones ante reinicios
o escalado.

## Indicadores y privacidad

- Estatus de usuarios: conteo por `usuarios.estatus`.
- Sentimiento por tema: promedio de `interacciones.sentimiento`.
- Actividad por día/hora: conteos en UTC, de lunes a domingo y de 00:00 a 23:00.
- Ubicaciones: conteos por ciudad/estado/país solo de usuarios con
  `consentimiento_datos = TRUE`; grupos menores a cinco no se muestran. No se
  envían coordenadas ni ubicaciones individuales al cliente.
- Las series se consultan mediante REST y los eventos de escritura llegan por
  WebSocket.

## Validación

```powershell
npm run lint
npm run build
```
