-- Consultas para las capturas de evidencia (Fase 2, apartado 4)

-- 1) Tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- 2) Conteo final de registros cargados
SELECT 'usuarios' AS tabla, COUNT(*) AS registros FROM usuarios
UNION ALL SELECT 'ubicaciones_usuario', COUNT(*) FROM ubicaciones_usuario
UNION ALL SELECT 'interacciones', COUNT(*) FROM interacciones
UNION ALL SELECT 'etiquetas', COUNT(*) FROM etiquetas
UNION ALL SELECT 'interaccion_etiqueta', COUNT(*) FROM interaccion_etiqueta
UNION ALL SELECT 'interacciones_cuarentena', COUNT(*) FROM interacciones_cuarentena
UNION ALL SELECT 'bitacora_etl', COUNT(*) FROM bitacora_etl;

-- 3) Usuarios sin consentimiento que tienen ubicación guardada (debe dar 0)
SELECT COUNT(*) AS sin_consentimiento_con_ubicacion
FROM usuarios u
JOIN ubicaciones_usuario l ON l.id_usuario = u.id_usuario
WHERE u.consentimiento_datos = FALSE;

-- 4) Resumen por consentimiento
SELECT u.consentimiento_datos,
       COUNT(*)           AS usuarios,
       COUNT(l.id_usuario) AS con_ubicacion,
       COUNT(l.latitud)    AS con_coordenadas
FROM usuarios u
LEFT JOIN ubicaciones_usuario l ON l.id_usuario = u.id_usuario
GROUP BY u.consentimiento_datos
ORDER BY u.consentimiento_datos;

-- 5) Cuarentena: motivos
SELECT motivo, COUNT(*) FROM interacciones_cuarentena GROUP BY motivo;

-- 6) Bitácora de la última ejecución
SELECT * FROM bitacora_etl ORDER BY id_ejecucion DESC LIMIT 4;

-- 7) Columnas de la tabla usuarios (ya no incluye datos geográficos)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuarios' ORDER BY ordinal_position;
