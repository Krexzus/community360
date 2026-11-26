# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, Tailwind CSS, Recharts, Fetch API y WebSocket API nativa. Backend: Node.js, TypeScript, Express y PostgreSQL `pg`.

## Users

Estudiantes que presentan COMMUNITY 360 y docentes que revisan la demostración en clase.

## Product Purpose

COMMUNITY 360 demuestra una arquitectura de datos en la nube para una comunidad virtual y presencial de creadores y aficionados. El dashboard permite consultar datos históricos y observar actualizaciones en tiempo real.

## Positioning

La aplicación combina datos depurados con ETL, persistencia en PostgreSQL de Aiven y un dashboard que consume datos reales mediante REST y WebSockets.

## Operating Context

La aplicación se presenta y ejecuta durante una revisión académica en clase. Las altas, modificaciones y eliminaciones de interacciones se hacen mediante Postman u otra herramienta, no mediante formularios del dashboard.

## Capabilities and Constraints

- El dashboard debe ser responsivo.
- Los datos históricos se consultan mediante una API REST y las actualizaciones se reciben mediante WebSockets.
- No se deben usar datos simulados como sustituto de los datos reales de Aiven.
- Las credenciales y cadenas de conexión permanecen en el backend o en variables de entorno; nunca se exponen en el frontend.
- Los usuarios sin consentimiento no deben conservar ni mostrar geografía, incluida ciudad, estado, país, coordenadas y zona horaria. La ubicación consentida solo se presenta en agregados de al menos cinco usuarios y nunca incluye coordenadas.
- Las interacciones huérfanas se conservan en cuarentena y no se publican como interacciones válidas.
- Indicadores actuales: usuarios registrados; interacciones válidas; interacciones en cuarentena y su proporción; interacciones por día, canal y tipo; usuarios por estatus; sentimiento por tema; actividad por día/hora UTC; ubicaciones agregadas de usuarios con consentimiento.
- El destino de despliegue está por definir.
- `GET /api/health`, autenticación con cookie, `GET /api/dashboard/summary` y operaciones CRUD de interacciones están implementadas para desarrollo local.
- Las operaciones CRUD son exclusivas del rol `admin`, se demuestran por Postman y emiten eventos WebSocket que actualizan el snapshot del dashboard.
- Las sesiones residen en memoria y se invalidan al reiniciar el backend; no desplegar públicamente sin almacenamiento de sesión, TLS con verificación del CA de Aiven y revisión de seguridad adicional.
- El cliente nunca se conecta directamente a PostgreSQL y no usa cifras simuladas.

## Evidence on Hand

- CSV originales de usuarios e interacciones en `data/raw/`.
- Esquema y consultas de verificación en `sql/`.
- Archivos depurados y resultados ETL en `data/clean/`.
- Base PostgreSQL en Aiven utilizada por la fase ETL.
- El dashboard frontend consume REST con sesión y WebSocket; la cuenta administradora inicial se debe crear con `npm run create-admin` tras aplicar la migración de usuario.

## Product Principles

1. Mostrar datos reales y trazables, no cifras simuladas.
2. Aplicar consentimiento y privacidad antes de presentar información geográfica.
3. Hacer visibles el estado y la actualización de los datos sin ocultar errores de conexión.
4. Mantener las operaciones de escritura fuera del dashboard; se demuestran mediante una herramienta API.
