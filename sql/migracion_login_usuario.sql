-- Migración aditiva para permitir iniciar sesión con un nombre de usuario.
-- No elimina ni modifica las tablas de datos del ETL.
-- Ejecutar una vez en el SQL Editor de Aiven antes de crear cuentas.

ALTER TABLE usuarios_sistema
    ADD COLUMN IF NOT EXISTS usuario VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_sistema_usuario
    ON usuarios_sistema (LOWER(usuario))
    WHERE usuario IS NOT NULL;
