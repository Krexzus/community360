# Backend de COMMUNITY 360

API Node.js + TypeScript de autenticación, métricas agregadas y administración
de interacciones. El navegador no se conecta directamente a Aiven.

## Requisitos y ejecución

- Node.js 24.18.0 (versión fijada en el `package.json` raíz).
- `DATABASE_URL` en el `.env` de la raíz, con `sslmode=require`.
- Esquema y datos del ETL cargados en Aiven.

```powershell
cd backend
npm ci
npm run dev
```

En desarrollo, el servidor escucha en `127.0.0.1:8000` por defecto. `HOST`,
`PORT` y `ALLOWED_ORIGINS` son configurables; si `ALLOWED_ORIGINS` no se define,
se aceptan `http://127.0.0.1:5173` y `http://localhost:5173`.

## Producción en Render

Desde la raíz del proyecto:

```powershell
npm run build
npm start
```

`npm run build` instala desde los lockfiles de `backend/` y `frontend/`, y luego
compila ambos proyectos. No ejecuta pruebas; las pruebas del backend se corren
por separado con `npm test --prefix backend`. `npm start` ejecuta con Node el
backend compilado y falla con un mensaje claro si falta `backend/dist/server.js`.
En producción, `HOST` usa `0.0.0.0` por defecto y el backend sirve `frontend/dist`
desde el mismo origen. Configura en Render `DATABASE_URL`, `NODE_ENV`,
`PORT`, `HOST` y `ALLOWED_ORIGINS`; establece `ALLOWED_ORIGINS` con el origen
público de Render, sin una ruta ni una barra final.

El driver conserva la semántica PostgreSQL de `sslmode=require` usada por el
ETL: cifra la conexión, pero no valida la identidad del certificado del
servidor. Para producción, configura el CA de Aiven y verifica el certificado.

## Cuenta inicial de evaluación

La columna de usuario es una migración aditiva. Ejecuta
`sql/migracion_login_usuario.sql` en el SQL Editor de Aiven una vez y luego
crea la cuenta en una terminal interactiva:

```powershell
npm run create-admin -- nombre_usuario correo@dominio.com
```

El comando solicita y confirma la contraseña sin mostrarla, requiere 14
caracteres y almacena un hash scrypt. No modifica una cuenta existente si el
usuario o correo ya está registrado. El rol creado es `admin`, según el permiso
solicitado para la demostración.

Las sesiones usan cookies `HttpOnly`, `SameSite=Lax` y token aleatorio; se
mantienen en memoria por ocho horas y se invalidan al reiniciar el proceso.
Login está limitado a cinco intentos por minuto y los mensajes de acceso no
revelan si falló el usuario o la contraseña.

## Rutas

- `GET /api/health`: comprueba conexión con PostgreSQL (sin datos de cuenta).
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- `GET /api/dashboard/summary`: snapshot histórico; requiere sesión.
- `POST /api/interactions`: crear interacción; rol `admin`.
- `PATCH /api/interactions/:id`: actualizar campos permitidos; rol `admin`.
- `DELETE /api/interactions/:id`: borrar interacción; rol `admin`.
- `GET /ws/events`: WebSocket autenticado por cookie y origen permitido.

Las operaciones de escritura usan consultas parametrizadas y respetan las
restricciones/FK del esquema. Los eventos WebSocket solo notifican tipo y hora;
no contienen texto ni datos personales de la interacción.

## Indicadores y consentimiento

- Estatus de usuario: agrupación por `usuarios.estatus`.
- Sentimiento por tema: promedio de `interacciones.sentimiento`.
- Actividad por día/hora: UTC, días ISO (lunes=1) y hora de 0 a 23.
- Ubicaciones: agregado por país/estado/ciudad, unido únicamente a usuarios con
  `consentimiento_datos IS TRUE`, y con mínimo de cinco usuarios por grupo.
  Latitud, longitud y ubicación individual nunca salen en la respuesta.

El resumen se consulta dentro de una transacción de solo lectura y snapshot
consistente. Los cambios hechos por Postman generan eventos para que el cliente
actualice los datos históricos.

## Comprobaciones

```powershell
npm test
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

El build y las pruebas son tareas separadas. Para producción, el frontend usa
rutas relativas del mismo origen para REST y deriva `ws:`/`wss:` para eventos;
`VITE_API_BASE_URL` y `VITE_EVENTS_WS_URL` se reservan para desarrollo local.

El driver conserva la semántica PostgreSQL de `sslmode=require` usada por el
ETL: cifra la conexión, pero no valida la identidad del certificado del
servidor. Antes de exponer la aplicación públicamente se requiere configurar el
CA de Aiven y verificar el certificado, además de revisar el almacenamiento de
sesiones ante reinicios o escalado.
