#!/usr/bin/env python3
"""
COMMUNITY 360 - Fase 2: limpieza, transformación y carga (ETL).

Ejecuta de forma secuencial y reproducible las 8 etapas del enunciado:
  1. Eliminación de duplicados          5. Verificación de referencias
  2. Normalización de nulos             6. Anulación de geografía sin consentimiento
  3. Estandarización de formatos        7. Exportación de archivos depurados
  4. Validación de tipos                8. Carga en PostgreSQL (Aiven)

Ningún registro se descarta en silencio: todo lo rechazado se conserva en
archivos de cuarentena con su motivo y queda contado en la bitácora.

Uso:
    python etl.py                # ejecuta las 8 etapas (requiere DATABASE_URL)
    python etl.py --sin-carga    # ejecuta solo las etapas 1 a 7
"""
import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent
# data/ y sql/ pueden vivir junto al script (etl/data, etl/sql) o en la raíz del proyecto.
RAIZ = BASE if (BASE / "sql" / "schema.sql").exists() else BASE.parent
ARCHIVOS_INTERACCIONES = [
    "comunidad_virtual_1000_interacciones.csv",
    "comunidad_virtual_interacciones_1000.csv",  # nombre que usa el enunciado
]
ARCHIVO_USUARIOS = "comunidad_virtual_usuarios.csv"

# Campos geográficos sujetos a la regla de privacidad
GEO_USUARIO = ["pais", "estado", "ciudad", "latitud", "longitud", "zona_horaria"]
GEO_INTERACCION = ["pais", "estado", "ciudad"]

NULOS = {"", "nan", "null", "none", "n/a", "na"}
SI = {"si", "sí", "1", "true", "verdadero"}
NO = {"no", "0", "false", "falso"}

# Catálogos permitidos (coinciden con los CHECK de sql/schema.sql)
VOCAB = {
    "rango_edad": ["18-24", "25-31", "32-38", "39+"],
    "plataforma_principal": ["Discord", "Facebook", "Instagram", "Telegram", "TikTok", "Twitter/X"],
    "estatus": ["activo", "en_riesgo", "inactivo"],
    "canal": ["Discord", "Facebook", "Instagram", "Telegram", "TikTok", "Twitter/X"],
    "tipo": ["mensaje", "comentario", "reaccion", "respuesta_encuesta", "rsvp_evento"],
    "tema": ["arte_comisiones", "eventos_convenciones", "fursuits", "memes_humor",
             "musica", "reglas_moderacion", "seguridad_privacidad", "videojuegos"],
    "dispositivo": ["Android", "Escritorio", "Web", "iOS"],
    "idioma": ["es"],
}

COLS_USUARIOS = [
    "id_usuario", "alias", "fecha_ingreso", "rango_edad", "especie_fursona", "interes_principal",
    "plataforma_principal", "es_artista", "mensajes_30d", "reacciones_30d", "eventos_asistidos",
    "comisiones_compradas", "sentimiento_promedio", "ultima_actividad", "estatus",
    "consentimiento_datos",
]
# La ubicación vive en su propia tabla (relación 1 a 0..1 con usuarios)
COLS_UBICACION = ["id_usuario", "pais", "estado", "ciudad", "latitud", "longitud", "zona_horaria"]
COLS_INTERACCIONES = [
    "id_interaccion", "id_usuario", "fecha_hora", "canal", "tipo", "texto", "tema",
    "sentimiento", "idioma", "dispositivo", "longitud_texto", "reacciones_recibidas",
]

log = logging.getLogger("etl")


# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------
def configurar_log(carpeta_logs: Path) -> Path:
    carpeta_logs.mkdir(parents=True, exist_ok=True)
    ruta = carpeta_logs / f"etl_{datetime.now():%Y%m%d_%H%M%S}.log"
    formato = logging.Formatter("%(asctime)s | %(message)s", "%H:%M:%S")
    log.setLevel(logging.INFO)
    for h in (logging.StreamHandler(sys.stdout), logging.FileHandler(ruta, encoding="utf-8")):
        h.setFormatter(formato)
        log.addHandler(h)
    return ruta


def leer_csv(ruta: Path) -> pd.DataFrame:
    # Todo se lee como texto para controlar explícitamente nulos y tipos.
    return pd.read_csv(ruta, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def contar_nulos(df: pd.DataFrame) -> dict:
    """Cuenta valores vacíos (cadena vacía, NA o marcadores de nulo) por columna."""
    res = {}
    for c in df.columns:
        s = df[c].astype("string").str.strip().str.lower()
        n = int((s.isna() | s.isin(NULOS)).sum())
        if n:
            res[c] = n
    return res


def a_booleano(valor):
    if pd.isna(valor):
        return pd.NA
    k = str(valor).strip().casefold()
    if k in SI:
        return True
    if k in NO:
        return False
    return pd.NA


def a_python(df: pd.DataFrame, columnas: list) -> list:
    """Convierte un DataFrame en filas con tipos nativos de Python (NA -> None)."""
    sub = df[columnas].astype(object)
    sub = sub.where(pd.notna(sub), None)
    filas = []
    for fila in sub.itertuples(index=False, name=None):
        filas.append(tuple(v.to_pydatetime() if isinstance(v, pd.Timestamp) else v for v in fila))
    return filas


# ----------------------------------------------------------------------------
# Etapas 1 a 6
# ----------------------------------------------------------------------------
def paso1_duplicados(df, nombre, claves_unicas, columnas_contenido, rechazos):
    """Elimina duplicados exactos, por identificador y por contenido. Los conserva en `rechazos`."""
    n0 = len(df)
    comparable = df.copy()
    for c in comparable.columns:
        comparable[c] = comparable[c].astype("string").str.strip().str.casefold()

    marca = pd.Series("", index=df.index)
    exacto = comparable.duplicated(keep="first")
    marca[exacto] = "duplicado_exacto"
    for col in claves_unicas:
        dup = comparable[col].duplicated(keep="first") & (marca == "")
        marca[dup] = f"duplicado_{col}"
    if columnas_contenido:
        dup = comparable.duplicated(subset=columnas_contenido, keep="first") & (marca == "")
        marca[dup] = "duplicado_contenido"

    rechazados = marca != ""
    rechazos.extend(zip(df.index[rechazados], marca[rechazados]))
    detalle = marca[rechazados].value_counts().to_dict()
    log.info(f"[PASO 1/8] {nombre}: {n0} recibidos | {int(rechazados.sum())} duplicados apartados {detalle}")
    return df[~rechazados].copy(), int(rechazados.sum()), detalle


def paso2_nulos(df, nombre):
    """Recorta espacios y unifica vacíos y marcadores de nulo como NA."""
    df = df.copy()
    df["_tocado"] = False
    por_columna = {}
    for c in [c for c in df.columns if c != "_tocado"]:
        original = df[c].astype("string")
        limpio = original.str.strip().str.replace(r"\s+", " ", regex=True)
        df.loc[(original != limpio).fillna(False), "_tocado"] = True
        es_nulo = limpio.str.lower().isin(NULOS)
        if int(es_nulo.sum()):
            por_columna[c] = int(es_nulo.sum())
        df[c] = limpio.mask(es_nulo, pd.NA)
    log.info(f"[PASO 2/8] {nombre}: nulos normalizados por columna {por_columna}")
    return df, por_columna


def _canonico(serie, vocab):
    mapa = {v.casefold(): v for v in vocab}
    nueva = serie.map(lambda x: mapa.get(str(x).casefold(), x) if pd.notna(x) else x).astype("string")
    cambio = (nueva != serie).fillna(False)
    return nueva, cambio


def paso3_estandarizar_usuarios(df):
    df = df.copy()
    ajustes = {}
    for col in ["rango_edad", "plataforma_principal", "estatus"]:
        df[col], cambio = _canonico(df[col], VOCAB[col])
        df.loc[cambio, "_tocado"] = True
        ajustes[col] = int(cambio.sum())
    df["fecha_ingreso"] = pd.to_datetime(df["fecha_ingreso"], format="%d/%m/%Y", errors="coerce")
    df["ultima_actividad"] = pd.to_datetime(df["ultima_actividad"], format="%d/%m/%Y", errors="coerce")
    df["es_artista"] = pd.array(df["es_artista"].map(a_booleano), dtype="boolean")
    df["consentimiento_datos"] = pd.array(df["consentimiento_datos"].map(a_booleano), dtype="boolean")
    log.info(f"[PASO 3/8] usuarios: categorías corregidas {ajustes}; fechas dd/mm/aaaa -> ISO; "
             "es_artista y consentimiento_datos -> booleano")
    return df, ajustes


def paso3_estandarizar_interacciones(df):
    df = df.copy()
    ajustes = {}
    for col in ["canal", "tipo", "tema", "dispositivo", "idioma"]:
        df[col], cambio = _canonico(df[col], VOCAB[col])
        df.loc[cambio, "_tocado"] = True
        ajustes[col] = int(cambio.sum())
    # Homologa todas las marcas de tiempo a UTC
    df["fecha_hora"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.drop(columns=["timestamp"])
    # longitud_texto: coherente con el texto (0 cuando no hay texto)
    sin_texto = df["texto"].isna()
    corregido = sin_texto & (df["longitud_texto"].fillna("0") != "0")
    df.loc[corregido, "longitud_texto"] = "0"
    df.loc[corregido, "_tocado"] = True
    ajustes["longitud_texto_corregida"] = int(corregido.sum())
    # Campo multivaluado: lista normalizada de etiquetas
    def separar(x):
        if pd.isna(x):
            return []
        vistas = []
        for t in str(x).split("|"):
            t = t.strip().lower()
            if t and t not in vistas:
                vistas.append(t)
        return vistas
    df["etiquetas"] = df["etiquetas"].map(separar)
    log.info(f"[PASO 3/8] interacciones: ajustes {ajustes}; timestamps -> UTC; etiquetas separadas en lista")
    return df, ajustes


def _num(s):
    """Convierte texto a float64; lo no numérico queda como NaN."""
    base = pd.Series([None if pd.isna(x) else x for x in s], index=s.index, dtype="object")
    return pd.to_numeric(base, errors="coerce").astype("float64")


def _entero(s):
    n = _num(s)
    valido = n.notna() & (n == n.round()) & (n >= 0)
    return n, valido


def paso4_validar_usuarios(df, rechazos):
    n0 = len(df)
    v = {}
    v["id_usuario"] = df["id_usuario"].str.fullmatch(r"U\d{6}").fillna(False)
    v["alias"] = df["alias"].notna() & (df["alias"].str.len() <= 50).fillna(False)
    v["fecha_ingreso"] = df["fecha_ingreso"].notna()
    v["ultima_actividad"] = df["ultima_actividad"].notna() & (df["ultima_actividad"] >= df["fecha_ingreso"])
    for col in ["rango_edad", "plataforma_principal", "estatus"]:
        v[col] = df[col].isin(VOCAB[col])
    for col in ["especie_fursona", "interes_principal"]:
        v[col] = df[col].notna()
    v["es_artista"] = df["es_artista"].notna()
    v["consentimiento_datos"] = df["consentimiento_datos"].notna()
    for col in ["mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"]:
        df[col], v[col] = _entero(df[col])
    sent = _num(df["sentimiento_promedio"])
    df["sentimiento_promedio"] = sent
    v["sentimiento_promedio"] = sent.between(-1, 1)
    lat = _num(df["latitud"])
    lon = _num(df["longitud"])
    v["latitud"] = df["latitud"].isna() | lat.between(-90, 90)
    v["longitud"] = df["longitud"].isna() | lon.between(-180, 180)
    df["latitud"], df["longitud"] = lat, lon
    ok, n_inv = _aplicar_validacion(df, v, "usuarios", n0, rechazos)
    for col in ["mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"]:
        ok[col] = ok[col].astype("int64")
    return ok, n_inv


def paso4_validar_interacciones(df, rechazos):
    n0 = len(df)
    v = {}
    v["id_interaccion"] = df["id_interaccion"].str.fullmatch(r"[A-Z]\d{7}").fillna(False)
    v["id_usuario"] = df["id_usuario"].str.fullmatch(r"U\d{6}").fillna(False)
    v["fecha_hora"] = df["fecha_hora"].notna()
    for col in ["canal", "tipo", "tema", "dispositivo", "idioma"]:
        v[col] = df[col].isin(VOCAB[col])
    sent = _num(df["sentimiento"])
    df["sentimiento"] = sent
    v["sentimiento"] = sent.between(-1, 1)
    for col in ["longitud_texto", "reacciones_recibidas"]:
        df[col], v[col] = _entero(df[col])
    ok, n_inv = _aplicar_validacion(df, v, "interacciones", n0, rechazos)
    for col in ["longitud_texto", "reacciones_recibidas"]:
        ok[col] = ok[col].astype("int64")
    return ok, n_inv


def _aplicar_validacion(df, validaciones, nombre, n0, rechazos):
    ok = pd.DataFrame(validaciones)
    fila_ok = ok.all(axis=1)
    motivos = ok[~fila_ok].apply(
        lambda r: "tipo_o_valor_invalido:" + ",".join(k for k, val in r.items() if not val), axis=1)
    rechazos.extend(zip(motivos.index, motivos))
    log.info(f"[PASO 4/8] {nombre}: {n0} validados | {int((~fila_ok).sum())} rechazados por tipo o rango inválido")
    return df[fila_ok].copy(), int((~fila_ok).sum())


def paso5_referencias(inter, ids_usuarios_validos, ids_usuarios_rechazados, rechazos):
    n0 = len(inter)
    existe = inter["id_usuario"].isin(ids_usuarios_validos)
    rechazado = inter["id_usuario"].isin(ids_usuarios_rechazados)
    motivo = pd.Series("usuario_inexistente", index=inter.index)
    motivo[rechazado] = "usuario_rechazado_en_validacion"
    huerfanas = ~existe
    rechazos.extend(zip(inter.index[huerfanas], motivo[huerfanas]))
    usuarios_huerfanos = int(inter.loc[huerfanas, "id_usuario"].nunique())
    log.info(f"[PASO 5/8] interacciones: {n0} verificadas | {int(huerfanas.sum())} huérfanas a cuarentena "
             f"({usuarios_huerfanos} id_usuario distintos inexistentes)")
    return inter[existe].copy(), int(huerfanas.sum()), usuarios_huerfanos


def paso6_privacidad(usu):
    """Separa la ubicación en su propia tabla y no la genera para quien no dio consentimiento.

    Quien tiene consentimiento_datos = 'no' no recibe ningún registro de ubicación; además, sus
    campos geográficos se anulan en memoria para que no salgan en ningún archivo.
    """
    sin_consent = usu["consentimiento_datos"] == False  # noqa: E712 (tipo boolean de pandas)
    con_consent = usu["consentimiento_datos"] == True  # noqa: E712
    tenia_geo = sin_consent & usu[GEO_USUARIO].notna().any(axis=1)
    campos_anulados = int(usu.loc[sin_consent, GEO_USUARIO].notna().sum().sum())
    afectados = int(tenia_geo.sum())
    usu.loc[sin_consent, GEO_USUARIO] = pd.NA
    usu.loc[tenia_geo, "_tocado"] = True

    # Tabla de ubicaciones: solo usuarios con consentimiento y con los datos obligatorios completos
    obligatorios = ["pais", "estado", "ciudad", "zona_horaria"]
    completos = con_consent & usu[obligatorios].notna().all(axis=1)
    ubic = usu.loc[completos, COLS_UBICACION].copy()
    incompletos = int((con_consent & ~completos).sum())
    residual = int(ubic["id_usuario"].isin(usu.loc[sin_consent, "id_usuario"]).sum())
    log.info(f"[PASO 6/8] usuarios sin consentimiento: {int(sin_consent.sum())} | con geografía anulada: "
             f"{afectados} | campos anulados: {campos_anulados}")
    log.info(f"[PASO 6/8] ubicaciones_usuario: {len(ubic)} registros generados (solo usuarios con consentimiento) | "
             f"{int(sin_consent.sum())} usuarios sin registro de ubicación | "
             f"usuarios sin consentimiento con ubicación: {residual}")
    if residual:
        raise RuntimeError("Falló la regla de privacidad: hay ubicaciones de usuarios sin consentimiento.")
    return usu, ubic, int(sin_consent.sum()), afectados, campos_anulados, incompletos


# ----------------------------------------------------------------------------
# Etapa 7: exportación
# ----------------------------------------------------------------------------
def construir_catalogo_etiquetas(inter):
    nombres = sorted({t for lista in inter["etiquetas"] for t in lista})
    return pd.DataFrame({"id_etiqueta": range(1, len(nombres) + 1), "nombre": nombres})


def construir_puente(inter, catalogo):
    ids = dict(zip(catalogo["nombre"], catalogo["id_etiqueta"]))
    filas = [(i, ids[t]) for i, lista in zip(inter["id_interaccion"], inter["etiquetas"]) for t in lista]
    return pd.DataFrame(filas, columns=["id_interaccion", "id_etiqueta"])


def construir_cuarentena(raw, rechazos, geo_a_quitar):
    """Arma la cuarentena con el registro original, sin campos geográficos."""
    filas = []
    vistos = set()
    for idx, motivo in rechazos:
        if (idx, motivo) in vistos:
            continue
        vistos.add((idx, motivo))
        original = {k: (v if v != "" else None) for k, v in raw.loc[idx].to_dict().items()
                    if k not in geo_a_quitar}
        filas.append({"id_interaccion": original.get("id_interaccion"),
                      "id_usuario": original.get("id_usuario"),
                      "motivo": motivo[:60],
                      "registro_original": json.dumps(original, ensure_ascii=False)})
    return pd.DataFrame(filas, columns=["id_interaccion", "id_usuario", "motivo", "registro_original"])


def paso7_exportar(carpeta, usu, inter, catalogo, puente, cuarentena, usu_rechazados, resumen, bitacora, ubic):
    carpeta.mkdir(parents=True, exist_ok=True)
    u = usu[COLS_USUARIOS].copy()
    u["fecha_ingreso"] = u["fecha_ingreso"].dt.strftime("%Y-%m-%d")
    u["ultima_actividad"] = u["ultima_actividad"].dt.strftime("%Y-%m-%d")
    i = inter[COLS_INTERACCIONES].copy()
    i["fecha_hora"] = i["fecha_hora"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    archivos = {
        "usuarios_limpios.csv": u,
        "ubicaciones_usuario.csv": ubic,
        "interacciones_limpias.csv": i,
        "etiquetas.csv": catalogo,
        "interaccion_etiqueta.csv": puente,
        "interacciones_cuarentena.csv": cuarentena,
        "usuarios_rechazados.csv": usu_rechazados,
        "bitacora_etl.csv": bitacora,
    }
    for nombre, df in archivos.items():
        df.to_csv(carpeta / nombre, index=False, encoding="utf-8")
        log.info(f"[PASO 7/8] archivo generado: {nombre} ({len(df)} filas)")
    with open(carpeta / "resumen_calidad.json", "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)
    log.info("[PASO 7/8] archivo generado: resumen_calidad.json")


# ----------------------------------------------------------------------------
# Etapa 8: carga en PostgreSQL
# ----------------------------------------------------------------------------
def paso8_cargar(usu, ubic, inter, catalogo, puente, cuarentena, bitacora):
    try:
        import psycopg2
        from psycopg2.extras import execute_values
        from dotenv import load_dotenv
    except ImportError as e:
        raise SystemExit(f"Falta instalar dependencias: {e}. Ejecuta: pip install -r requirements.txt")

    load_dotenv(RAIZ / ".env")
    load_dotenv(BASE / ".env")
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Falta la variable de entorno DATABASE_URL (consulta .env.example).")

    esquema = (RAIZ / "sql" / "schema.sql").read_text(encoding="utf-8")
    cols_u = ", ".join(COLS_USUARIOS)
    set_u = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLS_USUARIOS if c != "id_usuario")
    cols_l = ", ".join(COLS_UBICACION)
    cols_i = ", ".join(COLS_INTERACCIONES)
    set_i = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLS_INTERACCIONES if c != "id_interaccion")

    try:
        conn = psycopg2.connect(dsn)
    except psycopg2.Error as e:
        raise SystemExit(f"No se pudo conectar a la base de datos: {type(e).__name__}. "
                         "Revisa DATABASE_URL, SSL y que el servicio esté encendido.")
    try:
        with conn:  # una sola transacción: o se carga todo o no se carga nada
            with conn.cursor() as cur:
                cur.execute(esquema)
                cur.execute("SELECT COUNT(*) FROM information_schema.columns "
                            "WHERE table_schema = current_schema() AND table_name = 'usuarios' "
                            "AND column_name = ANY(%s)", (GEO_USUARIO,))
                if cur.fetchone()[0]:
                    raise SystemExit("El esquema en la nube es anterior al modelo vigente (usuarios todavía "
                                     "tiene columnas geográficas). No se cargó nada. "
                                     "Ejecuta primero: python etl.py --reiniciar-esquema")
                log.info("[PASO 8/8] esquema verificado/creado en la nube")
                execute_values(cur, "INSERT INTO etiquetas (id_etiqueta, nombre) VALUES %s "
                                    "ON CONFLICT (id_etiqueta) DO UPDATE SET nombre = EXCLUDED.nombre",
                               a_python(catalogo, ["id_etiqueta", "nombre"]))
                # La ubicación se recarga completa en cada ejecución: si alguien retira su consentimiento
                # entre una carga y otra, su ubicación desaparece también de la base.
                cur.execute("TRUNCATE ubicaciones_usuario")
                execute_values(cur, f"INSERT INTO usuarios ({cols_u}) VALUES %s "
                                    f"ON CONFLICT (id_usuario) DO UPDATE SET {set_u}",
                               a_python(usu, COLS_USUARIOS), page_size=500)
                execute_values(cur, f"INSERT INTO ubicaciones_usuario ({cols_l}) VALUES %s",
                               a_python(ubic, COLS_UBICACION), page_size=500)
                cur.execute("SELECT COUNT(*) FROM ubicaciones_usuario l JOIN usuarios u USING (id_usuario) "
                            "WHERE u.consentimiento_datos = FALSE")
                if cur.fetchone()[0]:
                    raise SystemExit("Regla de privacidad incumplida en la base: se revierte la carga.")
                execute_values(cur, f"INSERT INTO interacciones ({cols_i}) VALUES %s "
                                    f"ON CONFLICT (id_interaccion) DO UPDATE SET {set_i}",
                               a_python(inter, COLS_INTERACCIONES), page_size=500)
                cur.execute("DELETE FROM interaccion_etiqueta WHERE id_interaccion = ANY(%s)",
                            (list(inter["id_interaccion"]),))
                if len(puente):
                    execute_values(cur, "INSERT INTO interaccion_etiqueta (id_interaccion, id_etiqueta) VALUES %s "
                                        "ON CONFLICT DO NOTHING", a_python(puente, ["id_interaccion", "id_etiqueta"]))
                cur.execute("TRUNCATE interacciones_cuarentena RESTART IDENTITY")
                if len(cuarentena):
                    execute_values(
                        cur, "INSERT INTO interacciones_cuarentena (id_interaccion, id_usuario, motivo, registro_original) "
                             "VALUES %s", a_python(cuarentena, ["id_interaccion", "id_usuario", "motivo", "registro_original"]),
                        template="(%s, %s, %s, %s::jsonb)")
                execute_values(cur, "INSERT INTO bitacora_etl (entidad, recibidos, aceptados, transformados, rechazados) "
                                    "VALUES %s", a_python(bitacora, ["entidad", "recibidos", "aceptados", "transformados", "rechazados"]))
                for tabla in ["usuarios", "ubicaciones_usuario", "interacciones", "etiquetas", "interaccion_etiqueta", "interacciones_cuarentena"]:
                    cur.execute(f"SELECT COUNT(*) FROM {tabla}")
                    log.info(f"[PASO 8/8] {tabla}: {cur.fetchone()[0]} registros en la nube")
        log.info("[PASO 8/8] carga confirmada (commit)")
    except psycopg2.Error as e:
        raise SystemExit(f"La carga falló y se revirtió la transacción: {type(e).__name__}: {e.pgerror or e}")
    finally:
        conn.close()


def reiniciar_esquema():
    """Borra las tablas de datos para recrearlas con el esquema vigente (destructivo)."""
    try:
        import psycopg2
        from dotenv import load_dotenv
    except ImportError as e:
        raise SystemExit(f"Falta instalar dependencias: {e}. Ejecuta: pip install -r requirements.txt")
    load_dotenv(RAIZ / ".env")
    load_dotenv(BASE / ".env")
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Falta la variable de entorno DATABASE_URL (consulta .env.example).")
    print("ATENCIÓN: se borrarán las tablas de datos del proyecto en la base de datos en la nube.")
    if input("Escribe REINICIAR para continuar: ").strip() != "REINICIAR":
        raise SystemExit("Cancelado. No se modificó nada.")
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute((RAIZ / "sql" / "reiniciar_esquema.sql").read_text(encoding="utf-8"))
        print("Esquema reiniciado. Ahora ejecuta: python etl.py")
    except psycopg2.Error as e:
        raise SystemExit(f"No se pudo reiniciar el esquema: {type(e).__name__}")


# ----------------------------------------------------------------------------
# Programa principal
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="ETL COMMUNITY 360 (Fase 2)")
    ap.add_argument("--raw-dir", default=str(RAIZ / "data" / "raw"), help="carpeta con los CSV originales")
    ap.add_argument("--clean-dir", default=str(RAIZ / "data" / "clean"), help="carpeta de salida")
    ap.add_argument("--sin-carga", action="store_true", help="omite la etapa 8 (carga en la nube)")
    ap.add_argument("--reiniciar-esquema", action="store_true",
                    help="borra las tablas de datos en la nube y termina (pide confirmación)")
    args = ap.parse_args()
    if args.reiniciar_esquema:
        reiniciar_esquema()
        return

    ruta_log = configurar_log(BASE / "logs")
    raw_dir, clean_dir = Path(args.raw_dir), Path(args.clean_dir)
    log.info("=== ETL COMMUNITY 360 - inicio ===")

    ruta_u = raw_dir / ARCHIVO_USUARIOS
    ruta_i = next((raw_dir / n for n in ARCHIVOS_INTERACCIONES if (raw_dir / n).exists()), None)
    if not ruta_u.exists() or ruta_i is None:
        raise SystemExit(f"No se encontraron los CSV en {raw_dir}")
    raw_u, raw_i = leer_csv(ruta_u), leer_csv(ruta_i)
    log.info(f"Leídos: {ruta_u.name} ({len(raw_u)} filas) y {ruta_i.name} ({len(raw_i)} filas)")

    nulos_antes = {"usuarios": contar_nulos(raw_u), "interacciones": contar_nulos(raw_i)}
    rech_u, rech_i = [], []

    # Etapas 1 a 3
    usu, dup_u, det_dup_u = paso1_duplicados(raw_u, "usuarios", ["id_usuario", "alias"], None, rech_u)
    inter, dup_i, det_dup_i = paso1_duplicados(
        raw_i, "interacciones", ["id_interaccion"],
        ["id_usuario", "timestamp", "canal", "tipo", "texto"], rech_i)
    usu, nulos_u = paso2_nulos(usu, "usuarios")
    inter, nulos_i = paso2_nulos(inter, "interacciones")
    usu, aj_u = paso3_estandarizar_usuarios(usu)
    inter, aj_i = paso3_estandarizar_interacciones(inter)

    # Etapa 4
    usu, inv_u = paso4_validar_usuarios(usu, rech_u)
    inter, inv_i = paso4_validar_interacciones(inter, rech_i)

    # Etapa 5
    ids_rechazados_u = {raw_u.loc[i, "id_usuario"] for i, _ in rech_u}
    inter, huerfanas, usuarios_huerfanos = paso5_referencias(
        inter, set(usu["id_usuario"]), ids_rechazados_u, rech_i)

    # Etapa 6
    usu, ubic, sin_consent, afectados, campos_anulados, ubic_incompletas = paso6_privacidad(usu)

    # Preparación de salidas
    catalogo = construir_catalogo_etiquetas(inter)
    puente = construir_puente(inter, catalogo)
    cuarentena = construir_cuarentena(raw_i, rech_i, GEO_INTERACCION)
    motivos_u = {}
    for i, m in rech_u:
        motivos_u.setdefault(i, []).append(m)
    usu_rech = raw_u.loc[list(motivos_u)].copy()
    usu_rech["motivo"] = [";".join(motivos_u[i]) for i in usu_rech.index]
    consent_rech = usu_rech["consentimiento_datos"].str.strip().str.casefold().isin(SI)
    usu_rech.loc[~consent_rech, GEO_USUARIO] = ""  # sin consentimiento claro: no se conserva geografía

    transf_u = int(usu["_tocado"].sum())
    transf_i = int(inter["_tocado"].sum())
    rechazados_u, rechazados_i = len(rech_u), len(rech_i)
    bitacora = pd.DataFrame([
        {"entidad": "usuarios", "recibidos": len(raw_u), "aceptados": len(usu),
         "transformados": transf_u, "rechazados": rechazados_u},
        {"entidad": "interacciones", "recibidos": len(raw_i), "aceptados": len(inter),
         "transformados": transf_i, "rechazados": rechazados_i},
    ])
    assert len(raw_u) == len(usu) + rechazados_u and len(raw_i) == len(inter) + rechazados_i, \
        "Descuadre: recibidos != aceptados + rechazados"

    nulos_despues = {
        "usuarios": {c: int(n) for c, n in usu[COLS_USUARIOS].isna().sum().items() if n},
        "interacciones": {c: int(n) for c, n in inter[COLS_INTERACCIONES].isna().sum().items() if n},
    }
    resumen = {
        "ejecucion": datetime.now().isoformat(timespec="seconds"),
        "archivos_origen": [ruta_u.name, ruta_i.name],
        "usuarios": {"recibidos": len(raw_u), "aceptados": len(usu), "rechazados": rechazados_u,
                     "duplicados_apartados": dup_u, "detalle_duplicados": det_dup_u,
                     "invalidos_por_tipo_o_rango": inv_u, "transformados": transf_u,
                     "nulos_normalizados_por_columna": nulos_u, "categorias_corregidas": aj_u},
        "interacciones": {"recibidas": len(raw_i), "aceptadas": len(inter), "rechazadas": rechazados_i,
                          "duplicados_apartados": dup_i, "detalle_duplicados": det_dup_i,
                          "invalidas_por_tipo_o_rango": inv_i, "huerfanas": huerfanas,
                          "id_usuario_huerfanos_distintos": usuarios_huerfanos, "transformadas": transf_i,
                          "nulos_normalizados_por_columna": nulos_i, "ajustes": aj_i,
                          "etiquetas_en_catalogo": len(catalogo), "relaciones_interaccion_etiqueta": len(puente)},
        "privacidad": {"usuarios_sin_consentimiento": sin_consent,
                       "usuarios_con_geografia_anulada": afectados,
                       "campos_geograficos_anulados": campos_anulados,
                       "ubicaciones_generadas": len(ubic),
                       "usuarios_sin_registro_de_ubicacion": len(usu) - len(ubic),
                       "con_consentimiento_sin_ubicacion_completa": ubic_incompletas,
                       "geografia_eliminada_de_interacciones": GEO_INTERACCION,
                       "geografia_eliminada_en_cuarentena": GEO_INTERACCION},
        "nulos_antes": nulos_antes,
        "nulos_despues": nulos_despues,
    }

    # Etapa 7
    paso7_exportar(clean_dir, usu.drop(columns="_tocado"), inter.drop(columns="_tocado"), catalogo,
                   puente, cuarentena, usu_rech, resumen, bitacora, ubic)

    # Etapa 8
    if args.sin_carga:
        log.info("[PASO 8/8] omitido por --sin-carga")
    else:
        paso8_cargar(usu, ubic, inter, catalogo, puente, cuarentena, bitacora)

    log.info("=== RESUMEN ===")
    log.info(bitacora.to_string(index=False))
    log.info(f"Bitácora de texto: {ruta_log.name} | Archivos depurados en: {clean_dir}")
    log.info("=== ETL COMMUNITY 360 - fin ===")


if __name__ == "__main__":
    main()
