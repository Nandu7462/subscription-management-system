# Local verification — 31 October 2026

Environment: Windows, Python 3.15, PostgreSQL 18.6. Installed versions are recorded in `requirements.lock.txt`.

- PostgreSQL integration suite: **46 passed**, including migration upgrade/downgrade, frontend hosting, recent-record ordering, and concurrent billing, payment and shared-discount tests.
- Frontend JavaScript API client: **7 passed**. Production Vite build completed successfully.
- Full-stack integration: actual JavaScript client → Vite proxy → FastAPI → PostgreSQL passed. Financial persistence was independently checked in the isolated database schema.
- Dependency consistency: `pip check` passed. Python compilation passed.
- Running API: readiness returned `{"status":"ready"}`, Swagger returned HTTP 200, and OpenAPI exposed 61 paths. The built frontend is served on the API origin; the development frontend proxies `/api` to FastAPI.
- Browser QA in an isolated test schema: admin login, product creation, subscription creation, quote/confirm/activate, generated invoice, confirmation, partial payment and updated balance all passed. Customer login showed only customer navigation and owned data. Desktop and 390px mobile layouts were inspected.

The local performance test seeded 3,000 subscriptions plus 3,000 invoices. Measured HTTP TestClient request times against PostgreSQL:

| Request | Seconds |
| --- | ---: |
| `/api/v1/subscriptions?limit=50` | 0.0211 |
| `/api/v1/invoices?limit=50` | 0.0258 |
| `/api/v1/reports/summary` | 0.0271 |

These measurements cover local paged queries and SQL aggregate reports; they do not establish production concurrency or network latency. The test suite emits a Starlette warning about its HTTPX TestClient integration; all assertions pass.

SMTP delivery to an external mail server was not exercised. Development email/PDF creation was tested through the local MIME-file transport. No scheduled task or production deployment was created; worker commands and deployment settings are documented in `README.md`.
