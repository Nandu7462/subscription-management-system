"""Exercise the actual JavaScript client -> Vite proxy -> FastAPI -> PostgreSQL.

Uses a randomly named disposable schema; leaves application records untouched.
--serve retains the isolated test stack for manual UI verification until Ctrl+C.
"""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
from uuid import uuid4

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
sys.path.insert(0, str(BACKEND))
TEST_PASSWORD = "StackOnly!123"  # Only used inside a disposable test schema.


def wait_ready(url, process):
    for _ in range(60):
        if process.poll() is not None:
            raise RuntimeError("Test server exited during startup; see the stack-check logs")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("Test server did not become ready")


def run(serve=False):
    configured = dict(dotenv_values(BACKEND / ".env"))
    value = os.environ.get("DATABASE_URL") or configured.get("DATABASE_URL", "")
    if not value.startswith("postgresql"):
        raise SystemExit("Stack verification requires PostgreSQL DATABASE_URL in backend/.env")
    node = shutil.which("node")
    if not node or not (FRONTEND / "node_modules/vite/bin/vite.js").exists():
        raise SystemExit("Install Node.js and run npm install in frontend first")
    for port in (18000, 15173):
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                raise SystemExit(f"Test port {port} is already in use; stop the earlier test stack first")
    schema = "test_stack_" + uuid4().hex
    admin_engine = create_engine(value)
    processes = []
    logs = BACKEND / ".stack-check"
    logs.mkdir(exist_ok=True)
    flags = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        url = make_url(value).update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(hide_password=False)
        environment = dict(os.environ, DATABASE_URL=url, SECRET_KEY=secrets.token_urlsafe(48), ENVIRONMENT="development",
                           SMTP_HOST="", MAIL_DIRECTORY=str(logs / "mail"), FRONTEND_URL="http://127.0.0.1:15173",
                           STACK_TEST_PASSWORD=TEST_PASSWORD, STACK_TEST_BASE="http://127.0.0.1:15173/api/v1")
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=environment, check=True, **flags)
        # Seed only the administrator. Customer registration and all financial records use the JS client.
        from app.core.security import password_hasher
        from app.models import User
        from sqlalchemy.orm import Session
        test_engine = create_engine(url)
        with Session(test_engine) as db:
            db.add(User(email="stack-admin@example.com", password_hash=password_hasher.hash(TEST_PASSWORD), role="admin"))
            db.commit()
        with (logs / "backend.log").open("w", encoding="utf-8") as api_log, (logs / "frontend.log").open("w", encoding="utf-8") as ui_log:
            api = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "18000"],
                                   cwd=BACKEND, env=environment, stdout=api_log, stderr=subprocess.STDOUT, **flags)
            processes.append(api)
            wait_ready("http://127.0.0.1:18000/api/v1/health/ready", api)
            frontend_env = dict(environment, API_PROXY_TARGET="http://127.0.0.1:18000", VITE_API_URL="/api/v1")
            ui = subprocess.Popen([node, str(FRONTEND / "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "15173"],
                                  cwd=FRONTEND, env=frontend_env, stdout=ui_log, stderr=subprocess.STDOUT, **flags)
            processes.append(ui)
            wait_ready("http://127.0.0.1:15173/api/v1/health/ready", ui)
            subprocess.run([node, "scripts/check-api.mjs"], cwd=FRONTEND, env=environment, check=True, **flags)
            with test_engine.connect() as connection:
                invoices = connection.execute(text("SELECT status, total, amount_paid FROM invoices")).one()
                assert str(invoices.total) == "3313.44" and str(invoices.amount_paid) == "2313.44"
                assert invoices.status == "partially_paid"
                assert connection.execute(text("SELECT count(*) FROM payments")).scalar_one() == 2
            print("PASS: financial records persisted correctly in PostgreSQL.", flush=True)
            if serve:
                print("Isolated UI test stack ready at http://127.0.0.1:15173 (Ctrl+C to clean up).", flush=True)
                stop_file = Path(os.environ["STACK_TEST_STOP_FILE"]) if os.environ.get("STACK_TEST_STOP_FILE") else None
                while stop_file is None or not stop_file.exists():
                    time.sleep(1)
        test_engine.dispose()
    finally:
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if "test_engine" in locals():
            test_engine.dispose()
        # Guard cleanup: this identifier is generated locally, never read from external input.
        assert schema.startswith("test_stack_") and len(schema) == 43
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", action="store_true")
    args = parser.parse_args()
    try:
        run(args.serve)
    except KeyboardInterrupt:
        print("Stopped isolated test stack and removed its test schema.")
