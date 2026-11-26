#!/usr/bin/env python3
"""Ejecuta en Aiven las consultas de solo lectura de sql/verificacion.sql."""

import re
import sys
from pathlib import Path

import psycopg2
from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
SQL_FILE = ROOT / "sql" / "verificacion.sql"


def load_queries(sql_text):
    queries = []
    for statement in sql_text.split(";"):
        if not statement.strip():
            continue

        description = re.search(r"(?m)^\s*--\s*\d+\)\s*(.+?)\s*$", statement)
        query = re.sub(r"(?m)^\s*--.*$", "", statement).strip()
        if not description or not query:
            continue
        if not re.match(r"(?is)^SELECT\b", query):
            raise ValueError("verificacion.sql contiene una instrucción que no es SELECT.")
        queries.append((description.group(1).strip(), query))

    if not queries:
        raise ValueError("No se encontraron consultas numeradas en verificacion.sql.")
    return queries


def print_table(columns, rows):
    values = [
        ["NULL" if value is None else str(value) for value in row]
        for row in rows
    ]
    widths = [
        max([len(columns[index])] + [len(row[index]) for row in values])
        for index in range(len(columns))
    ]

    print(" | ".join(columns[index].ljust(widths[index]) for index in range(len(columns))))
    print("-+-".join("-" * width for width in widths))
    if values:
        for row in values:
            print(" | ".join(row[index].ljust(widths[index]) for index in range(len(columns))))
    else:
        print("(sin filas)")


def connection_cause(error):
    message = str(error).casefold()
    if any(term in message for term in ("ssl", "tls", "certificate")):
        return "posible problema SSL/TLS"
    if "authentication failed" in message:
        return "falló la autenticación"
    if "no pg_hba.conf entry" in message or "not allowed" in message:
        return "posible restricción de acceso o IP"
    if "could not translate host" in message or "name or service not known" in message:
        return "posible problema de DNS"
    if any(term in message for term in ("timeout", "timed out", "connection refused", "network is unreachable")):
        return "posible servicio apagado o problema de red"
    return "revisa servicio, SSL y acceso de red"


def main():
    if not ENV_FILE.is_file():
        print("Error: no se encontró el archivo .env en la raíz del proyecto.", file=sys.stderr)
        return 1
    if not SQL_FILE.is_file():
        print("Error: no se encontró sql/verificacion.sql.", file=sys.stderr)
        return 1

    dsn = dotenv_values(ENV_FILE, encoding="utf-8").get("DATABASE_URL")
    if not dsn:
        print("Error: DATABASE_URL no está definida en el archivo .env.", file=sys.stderr)
        return 1

    try:
        queries = load_queries(SQL_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"Error al leer las consultas: {error}", file=sys.stderr)
        return 1

    try:
        connection = psycopg2.connect(dsn, connect_timeout=15)
    except psycopg2.Error as error:
        print(
            f"Error de conexión ({type(error).__name__}; {connection_cause(error)}). "
            "DATABASE_URL omitida.",
            file=sys.stderr,
        )
        return 1

    try:
        connection.set_session(readonly=True)
        with connection.cursor() as cursor:
            for number, (description, query) in enumerate(queries, 1):
                try:
                    cursor.execute(query)
                except psycopg2.Error as error:
                    print(
                        f"Error en CONSULTA {number} ({type(error).__name__}). "
                        "DATABASE_URL omitida.",
                        file=sys.stderr,
                    )
                    return 1

                print(f"\nCONSULTA {number}: {description}")
                print_table(
                    [column.name for column in cursor.description],
                    cursor.fetchall(),
                )
    finally:
        connection.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
