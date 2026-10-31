# Local verification — 31 October 2026

Environment: Windows, Python 3.15, PostgreSQL 18.6. Installed versions are recorded in `requirements.lock.txt`.

- PostgreSQL integration suite: **43 passed**, including migration upgrade/downgrade and concurrent billing, payment and shared-discount tests.
- SQLite compatibility suite: **40 passed, 3 skipped**. The skipped tests require PostgreSQL row locks.
- Dependency consistency: `pip check` passed. Python compilation passed.
- Running API: readiness returned `{"status":"ready"}`, Swagger returned HTTP 200, and OpenAPI exposed 61 paths.

The local performance test seeded 3,000 subscriptions plus 3,000 invoices. Measured HTTP TestClient request times against PostgreSQL:

| Request | Seconds |
| --- | ---: |
| `/api/v1/subscriptions?limit=50` | 0.0211 |
| `/api/v1/invoices?limit=50` | 0.0258 |
| `/api/v1/reports/summary` | 0.0271 |

These measurements cover local paged queries and SQL aggregate reports; they do not establish production concurrency or network latency. The test suite emits a Starlette warning about its HTTPX TestClient integration; all assertions pass.

SMTP delivery to an external mail server was not exercised. Development email/PDF creation was tested through the local MIME-file transport. No scheduled task or production deployment was created; worker commands and deployment settings are documented in `README.md`.
