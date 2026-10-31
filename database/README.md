# Database

Database files for the subscription management system live here:

- `migrations/`: version-controlled Alembic migrations, including the initial schema.
- `schema.sql`: PostgreSQL schema export for inspection; Alembic migrations are the source of truth for updates.
- `compose.yaml`: optional Docker PostgreSQL service; stores its data in ignored `docker-data/`.
- `.local-postgres/`: ignored local PostgreSQL cluster, credentials and server log, managed by the backend helper.
- `subscriptions.db`: ignored SQLite development database, if used.

Run operational commands from `../backend` so they load its `.env` and Python environment:

```powershell
.\.venv\Scripts\python.exe scripts/dev_postgres.py start --configure
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe scripts/export_schema.py
```

To use Docker instead, configure `POSTGRES_PASSWORD` and `DATABASE_URL` in `backend/.env`, then run from `backend`:

```powershell
docker compose --env-file .env -f ../database/compose.yaml up -d db
```

Local PostgreSQL uses port 55432; Docker uses 5432. Their physical data directories are separate. Keep database data, passwords and `.env` files out of Git. Backend ORM models and session code remain in `backend/app`.
