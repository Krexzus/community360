# COMMUNITY 360 – Fase 2 (ETL)

Script reproducible de limpieza, transformación y carga en PostgreSQL (Aiven).

## Estructura

```
etl.py                  script principal (8 etapas)
sql/schema.sql          esquema de la base (debe coincidir con tu Fase 1 validada)
sql/verificacion.sql    consultas para las capturas de evidencia
data/raw/               CSV originales
data/clean/             archivos depurados (se generan al ejecutar)
logs/                   bitácora de cada ejecución (se genera al ejecutar)
.env.example            plantilla de la cadena de conexión
```

## Preparación

1. Crea tu servicio PostgreSQL en Aiven (plan gratuito) y espera a que esté "Running".
2. Copia `.env.example` como `.env` y pega tu **Service URI** de Aiven en `DATABASE_URL`.
   Debe terminar en `?sslmode=require`. **No subas `.env` a ningún repositorio.**
3. Instala dependencias:

```bash
python -m venv .venv
# Windows:  .venv\Scripts\activate      Linux/Mac:  source .venv/bin/activate
pip install -r requirements.txt
```

## Ejecución

```bash
python etl.py --sin-carga   # prueba local: etapas 1 a 7, sin tocar la nube
python etl.py               # etapas 1 a 8: incluye la carga en Aiven
```

La carga es repetible: usa `INSERT ... ON CONFLICT`, así que ejecutarla otra vez no duplica datos.
Todo ocurre en una sola transacción: si algo falla, no se carga nada.

## Verificación en la nube

Ejecuta `sql/verificacion.sql` en la consola de Aiven, con `psql` o con la extensión de
PostgreSQL de VS Code. Las consultas muestran tablas creadas, conteos finales y que los
usuarios sin consentimiento no conservan datos geográficos (debe dar 0).

## Reiniciar el esquema en la nube

Si cambió el modelo de datos (por ejemplo, la ubicación pasó a la tabla `ubicaciones_usuario`),
las tablas viejas de la nube hay que borrarlas antes de cargar:

```bash
python etl.py --reiniciar-esquema   # destructivo: pide escribir REINICIAR para confirmar
python etl.py
```

Si intentas cargar sobre un esquema anterior, el script se niega y no modifica nada.

## Decisiones de diseño

- La ubicación (`pais`, `estado`, `ciudad`, `latitud`, `longitud`, `zona_horaria`) vive en su propia
  tabla, `ubicaciones_usuario`, con relación 1 a 0..1 con `usuarios`. Solo tienen fila los usuarios
  con consentimiento; quienes dijeron "no" no tienen ninguna.
- La geografía **no se guarda en `interacciones`**: coincidía con la del usuario y se obtiene por JOIN.
- La base refuerza la regla con un disparador (`trg_ubicacion_consentimiento`) que rechaza guardar
  ubicación de un usuario sin consentimiento.
- Las interacciones huérfanas van a `interacciones_cuarentena` (con su motivo y sin campos
  geográficos); nada se elimina en silencio.
- Si el docente pide cambios a tu modelo, modifica `sql/schema.sql` y las listas `COLS_*` de `etl.py`.

## Si algo falla

- *No se pudo conectar*: revisa `DATABASE_URL`, que el servicio esté encendido (el plan gratuito se
  apaga por inactividad) y las reglas de IP permitidas.
- *Falta DATABASE_URL*: el archivo `.env` debe estar junto a `etl.py`.
