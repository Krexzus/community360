-- DESTRUCTIVO: borra las tablas de datos del proyecto para recrearlas con el esquema vigente.
-- No toca usuarios_sistema. Se ejecuta con: python etl.py --reiniciar-esquema
DROP TABLE IF EXISTS interaccion_etiqueta, interacciones_cuarentena, interacciones,
    ubicaciones_usuario, usuarios, etiquetas, bitacora_etl CASCADE;
DROP FUNCTION IF EXISTS fn_ubicacion_requiere_consentimiento() CASCADE;
