"""Export PostgreSQL DDL to database/schema.sql without data or credentials."""
import os
from pathlib import Path
import subprocess
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
from dev_postgres import binary

ROOT = Path(__file__).resolve().parents[1]


def export_schema():
    value = os.environ.get("DATABASE_URL") or dotenv_values(ROOT / ".env").get("DATABASE_URL")
    if not value or not value.startswith("postgresql"):
        raise SystemExit("Configure a PostgreSQL DATABASE_URL before exporting the schema")
    url = make_url(value)
    environment = dict(os.environ)
    if url.password:
        environment["PGPASSWORD"] = url.password
    target = ROOT.parent / "database" / "schema.sql"
    subprocess.run([binary("pg_dump"), "--host", url.host or "localhost", "--port", str(url.port or 5432),
                    "--username", url.username or "postgres", "--dbname", url.database,
                    "--schema-only", "--no-owner", "--no-privileges", "--no-password", "--file", str(target)],
                   env=environment, check=True,
                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    print("Exported database/schema.sql")


if __name__ == "__main__":
    export_schema()
