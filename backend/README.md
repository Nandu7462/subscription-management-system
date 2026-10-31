# Subscription Management Backend

FastAPI, SQLAlchemy, PostgreSQL, Alembic, JWT and Argon2. Includes products and variants, plans and included products, quotation templates, subscription lifecycle, taxes, discounts, recurring invoices, printable PDFs, email, partial payments and reversals, customer portal, and financial reports.

## Run on this machine

Run these commands in PowerShell from `backend`:

```powershell
.\.venv\Scripts\python.exe scripts/dev_postgres.py start --configure
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.cli create-admin --email admin@example.com
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The administrator command prompts for a password. There are no default accounts or passwords. Open <http://localhost:8000/docs>, click **Authorize**, and use the administrator's email as the username. JSON clients use `POST /api/v1/auth/login` with `email` and `password`.

An isolated PostgreSQL instance has been initialized at `127.0.0.1:55432`. Its data and generated credentials are stored in ignored `../database/.local-postgres/` and backend `.env` files. The helper uses your installed PostgreSQL binaries and does not modify the system PostgreSQL service. After reboot, run the start command again. To stop only this instance:

```powershell
.\.venv\Scripts\python.exe scripts/dev_postgres.py stop
```

## Install on another machine

Use Python 3.12 or newer, then:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Generate `SECRET_KEY` using `python -c "import secrets; print(secrets.token_urlsafe(48))"`, replace the placeholder in `.env`, and set `DATABASE_URL` to your PostgreSQL connection. Never commit `.env` or database credentials. `requirements.lock.txt` records the versions tested on Windows/Python 3.15; `requirements.txt` supports compatible versions on other environments.

With PostgreSQL installed, the local helper above can initialize the development database. Alternatively, set `POSTGRES_PASSWORD` in `.env`, update the password in `DATABASE_URL`, and run `docker compose --env-file .env -f ../database/compose.yaml up -d db`. Apply `alembic upgrade head` before starting the API. SQLite (`DATABASE_URL=sqlite:///../database/subscriptions.db`) is supported for single-process exploration and fast unit tests; use PostgreSQL for concurrent billing and payments.

## Demo

After creating the admin:

```powershell
.\.venv\Scripts\python.exe -m app.cli seed-demo --email demo@example.com
```

This prompts for a customer password and creates a product, monthly plan, illustrative 18% tax, active subscription, and a draft invoice. It prints the customer and subscription IDs. In Swagger, confirm the invoice, record a partial payment, inspect reports, then log in as the demo customer and open `/portal/invoices`.

## Frontend API contract

- Base URL: `http://localhost:8000/api/v1`; interactive contract: `/docs`; machine-readable contract: `/openapi.json`.
- Login: `POST /auth/login`, body `{"email":"admin@example.com","password":"your-password"}`. Use `Authorization: Bearer <access_token>` on subsequent requests.
- Financial amounts are decimal strings; dates are ISO `YYYY-MM-DD`; timestamps are ISO 8601. IDs are UUID strings. Statuses and roles are lowercase.
- Lists return `{"items": [], "total": 0, "offset": 0, "limit": 50}`. Use `offset` and `limit` (1–100). Subscription and invoice lists accept `status`.
- New records return 201. Invalid inputs return 422, invalid credentials 401, permission failures 403, missing or another customer's private resources 404, conflicting states 409, and throttled authentication requests 429.
- Customers register through `/auth/register`. Staff/admin find their customer IDs through `/customers`. Admin creates staff through `/staff` and manages roles/status through `/users/{id}`.
- Product, plan, tax and discount writes require admin. Staff/admin manage quotations, subscriptions and invoices, record payments and view reports. Payment reversals require admin. Customers can view their own records and perform allowed pause/resume/renew/close operations.
- Draft invoices are hidden from customers. Every private lookup and action, including PDF downloads, checks ownership.
- Payment bodies require `amount`, `method` (`cash`, `bank_transfer`, `card`, `upi`, `cheque`, `other`) and a client-generated `idempotency_key` (8–100 characters). Optional fields: `payment_date` (defaults to today), `notes`. Reusing an identical key returns the original payment; different data with that key returns 409.
- Supported reports: `/reports/summary`, `/reports/revenue?start_date=...&end_date=...`, `/reports/subscriptions`, `/reports/payments?start_date=...&end_date=...`, `/reports/overdue-invoices`.

Create a subscription using a `customer_id`, `plan_id`, `start_date`, optional `expiry_date`, `payment_terms` in days, and `lines` containing `product_id`, optional `variant_id`, `quantity`, optional `unit_price`, optional `tax_rule_id`. Omitting lines uses plan products. Templates store the same line fields. Assign discounts **before activation** for the first invoice; issued invoices remain historical snapshots.

## Billing policies

- State sequence: `draft → quotation → confirmed → active → closed`, with `paused` available from active. Reissuing `/quote` refreshes quotation validity. Expired quotations cannot be confirmed.
- Billing is in advance. Activation generates all due cycles through today, within the batch cap. Future starts wait until their start date. Month/year cycles are calculated from the original anchor: Jan 31 → Feb 28 → Mar 31; leap-day annual anchors return to Feb 29 in leap years.
- Plan price is a separate recurring fee, added to product lines. Set it to zero when product lines supply the complete price. Variant extras apply automatically unless staff explicitly overrides `unit_price`. Plan fee, interval and product prices are snapshotted when the subscription is created. The plan fee is untaxed; product lines accept tax rules.
- Expiry is inclusive. Cycles starting on or before expiry are billed in full, with no proration. Historical missed cycles are caught up before automatic closure. The last invoice period ends at expiry. Paused subscriptions freeze their next billing date and expiry by the pause duration; resume establishes a new calendar anchor. Automatic expiry does not close a paused subscription while its clock is frozen.
- Each cycle has a database unique key `(subscription_id, billing_period)`. The worker locks the subscription, creates invoices and advances its cursor in one transaction. Failed work rolls back both. Competing workers skip locked subscriptions; the next scheduled run revisits remaining work.
- A worker run processes up to 1,000 cycles per subscription in batches of 100 subscriptions; additional backlog remains due for the next run. Pause and close reject unresolved backlogs rather than abandoning unpaid cycles. Manual generation returns a count of zero if no cycle is due.
- Discounts are explicitly assigned to subscriptions. Eligibility is checked on the cycle date against dates, active status, invoice subtotal, total product quantity, product/subscription scope, and usage limit. There is at most one discount per line, with deterministic rule ID priority. A fixed discount has one shared budget across eligible lines per invoice. Usage counts once per invoice; shared rules are locked to enforce global limits.
- Discounts apply before tax. Each line rounds to cents using Decimal/ROUND_HALF_UP, then totals are summed. Tax rates and billing details are saved on invoices. Later rule/product edits do not alter existing invoices. Monetary totals must fit `NUMERIC(14,2)`.
- Generated invoices are drafts and need staff confirmation. Confirmed zero-total invoices become paid. Draft/cancelled invoices are excluded from financial reports. Collected payments exclude reversed payments; invoiced revenue and cash received are reported separately. Overdue means an issued invoice with a past due date and a positive balance.
- Cancellation retains the original cycle and does not regenerate it or restore discount usage. Payments must be reversed before cancellation. No credits, card processing, proration, invoice replacements, or payment provider integration is implied by recording a payment.
- Reopening a closed subscription through renewal starts at the later of today and the day after its old expiry. Active renewal extends expiry without resetting the billing cursor.

## Scheduled jobs

Schedule these commands through Windows Task Scheduler, cron, or your deployment scheduler:

```powershell
.\.venv\Scripts\python.exe -m app.jobs.generate_invoices
.\.venv\Scripts\python.exe -m app.jobs.close_expired
```

Run billing at least daily. The expiry job also catches up billing first. Jobs do not start in API processes. Failures are logged in `billing_job_logs`; sensitive subscription, invoice, payment and account changes are recorded in `audit_logs`. The billing command exits nonzero on failures so your scheduler can alert.

## Email

Set the SMTP fields in `.env` for actual delivery. Development mode without SMTP writes MIME `.eml` messages to `.mail/`, including reset links and attached invoice PDFs. Reset tokens expire after 30 minutes, are stored as hashes, can be claimed only once, and revoke existing access tokens on successful reset. Production configuration requires PostgreSQL and SMTP. Delivery failures are logged and must be monitored; emails are sent synchronously, and a transactional email outbox is a future deployment improvement.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest_tmp --tb=short
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest_tmp_pg --tb=short --postgres
.\.venv\Scripts\python.exe -m pytest -s -q --basetemp=.pytest_tmp_perf --postgres tests/test_performance.py
```

The PostgreSQL suite creates randomly named test schemas and removes only those schemas afterward. It requires a database role with permission to create schemas. It verifies the customer-to-payment journey, permissions, single-use password resets, policy validation, calendar anchors, missed cycles, transactional retries, cycle uniqueness, discount eligibility, snapshots, payment retries/reversals, reports, SQLite migration upgrade/downgrade, and real PostgreSQL billing/payment/discount concurrency. The performance test seeds 3,000 subscriptions plus 3,000 invoices and requires paged APIs and dashboard requests under two seconds. This is a local benchmark, not a production load guarantee.

## Deployment

Set `ENVIRONMENT=production`, PostgreSQL and SMTP settings, a random `SECRET_KEY`, explicit `CORS_ORIGINS`, and an HTTPS `FRONTEND_URL`. Install dependencies, run migrations once per release, create an admin, and run `uvicorn app.main:app --host 0.0.0.0 --port 8000` behind an HTTPS reverse proxy. Run billing jobs separately. Back up PostgreSQL and test restoration. `/api/v1/health` checks process health; `/api/v1/health/ready` checks database connectivity and the migration table.

The authentication limiter is an in-process development guard (20 requests per IP per minute shared across auth endpoints). Use a shared reverse-proxy/Redis limiter for multiple production replicas. API authorization uses short-lived bearer JWTs; password resets and user role/status changes revoke older tokens. No payment credentials are stored. Provision a regular application database role for deployment; the local initialization role has development-only administrative permissions.

Implementation references: [FastAPI JWT/Argon2 guide](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [FastAPI dependency transaction cleanup](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/), [SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html), and [SQLAlchemy row locking](https://docs.sqlalchemy.org/en/20/core/selectable.html).

Database migrations, PostgreSQL schema export, Docker configuration and local data are organized in [`../database`](../database/README.md). Alembic commands still run from `backend`.
