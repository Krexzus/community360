-- Esquema COMMUNITY 360 (PostgreSQL). Debe coincidir con el modelo de la Fase 1.
-- Es idempotente: se puede ejecutar varias veces sin error.

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario            VARCHAR(7)    PRIMARY KEY,
    alias                 VARCHAR(50)   NOT NULL UNIQUE,
    fecha_ingreso         DATE          NOT NULL,
    rango_edad            VARCHAR(5)    NOT NULL CHECK (rango_edad IN ('18-24','25-31','32-38','39+')),
    especie_fursona       VARCHAR(30)   NOT NULL,
    interes_principal     VARCHAR(30)   NOT NULL,
    plataforma_principal  VARCHAR(20)   NOT NULL
        CHECK (plataforma_principal IN ('Discord','Facebook','Instagram','Telegram','TikTok','Twitter/X')),
    es_artista            BOOLEAN       NOT NULL,
    mensajes_30d          INTEGER       NOT NULL CHECK (mensajes_30d >= 0),
    reacciones_30d        INTEGER       NOT NULL CHECK (reacciones_30d >= 0),
    eventos_asistidos     INTEGER       NOT NULL CHECK (eventos_asistidos >= 0),
    comisiones_compradas  INTEGER       NOT NULL CHECK (comisiones_compradas >= 0),
    sentimiento_promedio  NUMERIC(4,3)  NOT NULL CHECK (sentimiento_promedio BETWEEN -1 AND 1),
    ultima_actividad      DATE          NOT NULL,
    estatus               VARCHAR(10)   NOT NULL CHECK (estatus IN ('activo','en_riesgo','inactivo')),
    consentimiento_datos  BOOLEAN       NOT NULL,
    CHECK (ultima_actividad >= fecha_ingreso)
);

-- La ubicación vive aparte: solo existe fila para usuarios con consentimiento (relación 1 a 0..1).
CREATE TABLE IF NOT EXISTS ubicaciones_usuario (
    id_usuario    VARCHAR(7)    PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    pais          VARCHAR(40)   NOT NULL,
    estado        VARCHAR(50)   NOT NULL,
    ciudad        VARCHAR(50)   NOT NULL,
    latitud       NUMERIC(8,4)  CHECK (latitud BETWEEN -90 AND 90),
    longitud      NUMERIC(8,4)  CHECK (longitud BETWEEN -180 AND 180),
    zona_horaria  VARCHAR(40)   NOT NULL
);

-- Regla de privacidad dentro de la base: rechaza guardar ubicación de quien no dio consentimiento.
CREATE OR REPLACE FUNCTION fn_ubicacion_requiere_consentimiento() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios
                   WHERE id_usuario = NEW.id_usuario AND consentimiento_datos IS TRUE) THEN
        RAISE EXCEPTION 'El usuario % no dio consentimiento para guardar su ubicación', NEW.id_usuario;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ubicacion_consentimiento ON ubicaciones_usuario;
CREATE TRIGGER trg_ubicacion_consentimiento
    BEFORE INSERT OR UPDATE ON ubicaciones_usuario
    FOR EACH ROW EXECUTE FUNCTION fn_ubicacion_requiere_consentimiento();

CREATE TABLE IF NOT EXISTS interacciones (
    id_interaccion        VARCHAR(8)    PRIMARY KEY,
    id_usuario            VARCHAR(7)    NOT NULL REFERENCES usuarios(id_usuario),
    fecha_hora            TIMESTAMPTZ   NOT NULL,
    canal                 VARCHAR(20)   NOT NULL
        CHECK (canal IN ('Discord','Facebook','Instagram','Telegram','TikTok','Twitter/X')),
    tipo                  VARCHAR(20)   NOT NULL
        CHECK (tipo IN ('mensaje','comentario','reaccion','respuesta_encuesta','rsvp_evento')),
    texto                 TEXT,
    tema                  VARCHAR(30)   NOT NULL
        CHECK (tema IN ('arte_comisiones','eventos_convenciones','fursuits','memes_humor',
                        'musica','reglas_moderacion','seguridad_privacidad','videojuegos')),
    sentimiento           NUMERIC(3,2)  NOT NULL CHECK (sentimiento BETWEEN -1 AND 1),
    idioma                CHAR(2)       NOT NULL,
    dispositivo           VARCHAR(15)   NOT NULL CHECK (dispositivo IN ('Android','Escritorio','Web','iOS')),
    longitud_texto        INTEGER       NOT NULL CHECK (longitud_texto >= 0),
    reacciones_recibidas  INTEGER       NOT NULL CHECK (reacciones_recibidas >= 0)
);
CREATE INDEX IF NOT EXISTS idx_interacciones_usuario ON interacciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_interacciones_fecha   ON interacciones(fecha_hora);

CREATE TABLE IF NOT EXISTS etiquetas (
    id_etiqueta  SMALLINT    PRIMARY KEY,
    nombre       VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS interaccion_etiqueta (
    id_interaccion VARCHAR(8) NOT NULL REFERENCES interacciones(id_interaccion) ON DELETE CASCADE,
    id_etiqueta    SMALLINT   NOT NULL REFERENCES etiquetas(id_etiqueta),
    PRIMARY KEY (id_interaccion, id_etiqueta)
);

CREATE TABLE IF NOT EXISTS interacciones_cuarentena (
    id_cuarentena     SERIAL       PRIMARY KEY,
    id_interaccion    VARCHAR(8),
    id_usuario        VARCHAR(7),
    motivo            VARCHAR(60)  NOT NULL,
    registro_original JSONB,
    fecha_rechazo     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bitacora_etl (
    id_ejecucion    SERIAL       PRIMARY KEY,
    fecha_ejecucion TIMESTAMPTZ  NOT NULL DEFAULT now(),
    entidad         VARCHAR(20)  NOT NULL,
    recibidos       INTEGER      NOT NULL CHECK (recibidos >= 0),
    aceptados       INTEGER      NOT NULL CHECK (aceptados >= 0),
    transformados   INTEGER      NOT NULL CHECK (transformados >= 0),
    rechazados      INTEGER      NOT NULL CHECK (rechazados >= 0)
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id_admin      SERIAL       PRIMARY KEY,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','analista')),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
