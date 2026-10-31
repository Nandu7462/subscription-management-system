"""Initialize an isolated local PostgreSQL instance using an existing installation.

Run from backend: python scripts/dev_postgres.py start --configure
No existing PostgreSQL service or data directory is modified.
"""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT.parent / "database" / ".local-postgres"
DATA = LOCAL / "data"
PORT = 55432


def binary(name):
    executable = name + (".exe" if os.name == "nt" else "")
    found = shutil.which(executable)
    if found:
        return found
    candidates = sorted(Path("C:/Program Files/PostgreSQL").glob(f"*/bin/{executable}"), reverse=True)
    if candidates:
        return str(candidates[0])
    raise SystemExit("Install PostgreSQL first, or use compose.yaml")


def run(name, *args, check=True):
    return subprocess.run([binary(name), *map(str, args)], check=check,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def start(configure=False):
    import psycopg
    from psycopg import sql
    LOCAL.mkdir(exist_ok=True)
    password_file = LOCAL / "password"
    if not (DATA / "PG_VERSION").exists():
        if DATA.exists() and any(DATA.iterdir()):
            raise SystemExit("Refusing to initialize a nonempty, unrecognized PostgreSQL directory")
        if not password_file.exists():
            password_file.write_text(secrets.token_urlsafe(36), encoding="utf-8")
        run("initdb", "-D", DATA, "-U", "subscriptions", "--auth=scram-sha-256", "--pwfile", password_file,
            "--encoding=UTF8", "--locale=C")
    password = password_file.read_text(encoding="utf-8")
    status = run("pg_ctl", "-D", DATA, "status", check=False)
    if status.returncode:
        run("pg_ctl", "-D", DATA, "-l", LOCAL / "server.log", "-o", f"-p {PORT} -h 127.0.0.1", "-w", "start")
    with psycopg.connect(host="127.0.0.1", port=PORT, user="subscriptions", password=password,
                         dbname="postgres", autocommit=True) as db:
        if not db.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("subscriptions",)).fetchone():
            db.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier("subscriptions")))
    if configure:
        env = ROOT / ".env"
        content = env.read_text(encoding="utf-8") if env.exists() else "SECRET_KEY=" + secrets.token_urlsafe(48) + "\n"
        lines = [line for line in content.splitlines() if not line.startswith("DATABASE_URL=")]
        lines.append(f"DATABASE_URL=postgresql+psycopg://subscriptions:{quote(password)}@127.0.0.1:{PORT}/subscriptions")
        env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Local PostgreSQL ready at 127.0.0.1:{PORT}; credentials stored only in ignored local files.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "stop", "status"])
    parser.add_argument("--configure", action="store_true", help="Write DATABASE_URL in backend/.env")
    args = parser.parse_args()
    if args.command == "start":
        start(args.configure)
    else:
        run("pg_ctl", "-D", DATA, *(["-m", "fast", "-w", "stop"] if args.command == "stop" else ["status"]))
