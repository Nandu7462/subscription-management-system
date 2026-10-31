# Subscription Management System

A connected React frontend, FastAPI backend and PostgreSQL database for subscription management and recurring billing.

## Run locally

The Python environment and local PostgreSQL instance are already configured on this machine. From the project root:

```powershell
npm run dev
```

This starts the local database when configured, applies its migrations, and launches the API and frontend. Existing Brightloop servers on the expected ports are reused. Ctrl+C stops servers started by the launcher; PostgreSQL stays running. Restart the launcher to reload backend code changes. Vite refreshes frontend code changes automatically.

- App: <http://127.0.0.1:5173>
- API documentation: <http://127.0.0.1:8000/docs>
- Database: PostgreSQL on `127.0.0.1:55432`, configured privately in `backend/.env`.

To create an administrator, run this from the project root and choose your password when prompted:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.cli create-admin --email admin@example.com
cd ..
```

Customers can register through the app. Staff accounts are created by an administrator in **Team & access**. Customer users see only their own subscriptions and issued invoices.

## How the connection works

```text
React browser app
  → /api/v1 (Vite proxy in development)
  → FastAPI routers, permissions and services
  → SQLAlchemy transactions
  → PostgreSQL (data stored under database/.local-postgres)
```

Frontend connection settings: `frontend/.env.example`. Backend database, CORS, email and secret settings: `backend/.env.example`. No database credentials are sent to the browser.

For a single-origin build, run `npm run build`, then start the API. FastAPI serves the built application at <http://127.0.0.1:8000> alongside `/api/v1`, so no Vite process is needed. Password-reset links also work with the built app. Set `FRONTEND_URL` to the chosen frontend origin when sending emails.

## First-time setup on another machine

Install Node.js (compatible with Vite 8), Python 3.12+ and PostgreSQL, then run:

```powershell
npm --prefix frontend install
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm run dev
```

When `backend/.env` is absent, the launcher initializes a separate local PostgreSQL instance using your installed binaries and writes a generated secret and connection string. For an existing PostgreSQL service or Docker, create `backend/.env` from its example, choose a random secret, and configure its `DATABASE_URL` before starting. See the database guide for Docker instructions. No default production account or password is created.

## Checks

```powershell
npm run test:frontend
npm run build
npm run check:stack
```

`check:stack` creates an isolated PostgreSQL schema, starts temporary API/frontend servers, and runs the actual JavaScript client through the Vite proxy. It verifies registration, login, products and variants, plans, taxes, discounts, quotation templates, subscription activation, invoice uniqueness, partial/full payments, retries, reversals, reports, PDFs and customer isolation. It then checks persisted financial records directly in PostgreSQL and removes only its generated test schema. Test ports are 15173 and 18000. Add `-- --serve` to retain the isolated stack for manual UI checks until Ctrl+C.

To run the backend suite, use the commands in [backend/README.md](backend/README.md). The test database role needs permission to create temporary schemas. [Verification results](backend/VERIFICATION.md) record the latest checks and limits.

## Project files

- [Frontend](frontend/README.md): interface, API client, forms and browser build.
- [Backend](backend/README.md): API, authentication, financial services, worker commands and deployment.
- [Database](database/README.md): schema export, Alembic migrations, Docker configuration and ignored local data.

External SMTP delivery, production deployment and automatic task scheduling require your deployment settings. Development email is written to `backend/.mail/`. Workers can be scheduled separately using the backend guide.

## Private files

Local `.env` files, private keys, credential files, database contents/backups, development email, uploads, exports and editor settings are ignored by Git. Keep any other personal documents under a `personal/`, `private/` or `local-only/` folder so they are ignored as well. `.env.example`, the database schema, migrations and application source remain versioned; examples must contain placeholders only.

Ignore rules do not remove files already tracked by Git and do not detect passwords pasted into source code. Review `git status` and staged changes before pushing; do not force-add ignored private files.
