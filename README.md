# Subscription Management System

**Brightloop** is a subscription management platform that brings customer accounts, recurring plans, invoices and payments into one workspace. It helps businesses manage the complete subscription journey—from a quotation to an active subscription, recurring billing and payment tracking.

Built for **Odoo x Make-A-Ton 9.0**, the project connects a React interface to a FastAPI backend and a PostgreSQL database. Business records are stored in the database and shared through authenticated APIs.

## What problem does it solve?

Subscription businesses need to track who is subscribed, when to bill them, what they owe and which payments have arrived. Managing these separately can lead to missed billing cycles, duplicate invoices and unclear balances.

This application gives administrators, staff and customers a shared system with access appropriate to their roles. It preserves invoice history, prevents duplicate subscription billing cycles and distinguishes money billed from money received.

## Features

| Feature | What you can do |
| --- | --- |
| Accounts and access | Register customers, sign in, reset passwords and manage administrator/staff/customer permissions. |
| Products and variants | Create products, set sales and cost prices, add variants with additional prices and archive products. |
| Subscription plans | Configure daily, weekly, monthly or yearly billing, recurring fees, minimum quantities, availability and subscription policies. |
| Quotations | Create reusable quotation templates with product lines and validity periods, then create customer subscriptions from them. |
| Subscription lifecycle | Move through Draft → Quotation → Confirmed → Active → Closed; pause, resume or renew where the plan permits. |
| Recurring billing | Generate due invoices, catch up missed cycles and prevent duplicate invoices for the same subscription billing period. |
| Taxes and discounts | Configure tax rates and fixed/percentage discounts, including validity dates, eligibility and redemption limits. |
| Invoice management | Review invoice line items, confirm or cancel eligible invoices, download PDFs and send invoice emails when SMTP is configured. |
| Payment tracking | Record payments already received, support partial/full payments, calculate outstanding balances and reverse payments with an audit trail. |
| Dashboard and reports | View active subscriptions, collected payments, outstanding balances and overdue invoices; compare invoiced amounts and cash received over a date range. |
| Customer portal | Let customers view their own subscriptions and issued invoices, download PDFs and perform permitted subscription actions. |
| Responsive interface | Use the workspace on desktop and mobile, with paginated tables, status filters and a search of the current page. |

## User roles

| Role | Main responsibilities |
| --- | --- |
| **Administrator** | Manage staff and access, products, plans, taxes and discounts; manage subscriptions, invoices, payments and reports. |
| **Staff** | Manage customer subscriptions and quotations, handle invoices, record payments and view reports. |
| **Customer** | View only their own subscriptions and issued invoices, download invoices and perform allowed pause/resume/renew/close actions. |

Permissions and customer ownership are checked by the backend as well as reflected in the interface. There is **no default administrator email or password**; you create your own administrator during setup.

## Getting started

### Requirements

- Node.js compatible with Vite 8, with npm available.
- Python 3.12 or newer, available as `python` in your terminal.
- PostgreSQL installed locally, or an existing PostgreSQL connection configured in `backend/.env`.

### Install and launch

The following commands are for **Windows using Git Bash**:

```bash
git clone https://github.com/Nandu7462/subscription-management-system.git
cd subscription-management-system

npm --prefix frontend install
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

npm run dev
```

If you already have the project and its dependencies installed, run only `npm run dev` from the project root.

The launcher applies database migrations and starts the frontend and backend. On a fresh setup without `backend/.env`, it uses installed PostgreSQL binaries to initialize a separate development database and generates local credentials. It reuses existing Brightloop servers on the expected ports.

| Service | Address |
| --- | --- |
| Application | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| Interactive API documentation | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| Local development PostgreSQL | `127.0.0.1:55432` |

For an existing database or Docker, configure `backend/.env` before starting. See the [database setup guide](database/README.md). Local PostgreSQL data is kept in `database/.local-postgres/` and excluded from Git.

### Create your administrator

Keep the application running and open a second Git Bash terminal in the project root:

```bash
cd backend
./.venv/Scripts/python.exe -m app.cli create-admin --email admin@example.com
cd ..
```

Replace `admin@example.com` with the email you want to use. The command prompts for your password; use at least nine characters with uppercase, lowercase and a special character. Sign in to the application with that email and password.

## How to use the application

### Administrator and staff workflow

1. **Set up your offering.** As an administrator, open **Products** to create a product and optional variants, then **Plans** to define its billing cycle and policies. The plan fee is added to product line prices; use a zero plan fee when product lines supply the full charge.
2. **Add your team and customers.** Administrators create staff accounts in **Team & access**. Customers use **Create an account** on the sign-in page; their profiles appear in **Customers**.
3. **Configure billing rules.** Add tax rules in **Taxes** and offers in **Discounts**. Create a template in **Quotations** if you want to reuse an offer.
4. **Create a subscription.** Open **Subscriptions → New subscription**. Select the customer, plan, dates and product lines, or choose a quotation template. Save it as a draft.
5. **Make it active.** Open the subscription, choose **Issue quotation**, then **Confirm quotation** and **Activate**. Assign any first-cycle discount before activation, because activation generates invoices for due billing cycles.
6. **Issue the invoice.** Open **Invoices**, select the generated draft and choose **Confirm invoice**. Download its PDF or send an email when email delivery is configured.
7. **Record money received.** In a confirmed invoice, choose **Record payment** and enter the amount, method and date. Partial payments leave an outstanding balance; full payments mark the invoice paid.
8. **Monitor and manage.** Use **Overview** to review balances and reports. Open a subscription to pause, resume, renew or close it according to its plan's rules.

To generate later billing cycles manually, open an active subscription and choose **Generate due invoices**. For unattended recurring billing, schedule the separate worker commands described in the [backend guide](backend/README.md#scheduled-jobs).

### Customer workflow

1. Open the application and choose **Create an account**, or sign in to an existing account.
2. View your subscriptions and their next billing dates in **Overview** or **Subscriptions**.
3. Open **Invoices** to check issued invoices, payment balances and PDF downloads.
4. Open a subscription to perform actions allowed by its plan. The backend rejects actions that the plan or subscription state does not permit.

Customers cannot access other customers' records. Subscriptions are created by staff or administrators after customer registration.

### Optional demonstration data

After creating an administrator, you can create a sample customer, product, monthly plan, illustrative tax rule and active subscription:

```bash
cd backend
./.venv/Scripts/python.exe -m app.cli seed-demo --email demo@example.com
cd ..
```

Choose a customer password when prompted. Sign in as the administrator to confirm the generated invoice and record a payment, then sign in as the demo customer to view the same issued invoice through the customer portal.

## Technology and project structure

| Layer | Technology |
| --- | --- |
| Frontend | React and Vite |
| Backend | Python, FastAPI and Pydantic |
| Database | PostgreSQL, SQLAlchemy and Alembic migrations |
| Authentication | JWT bearer tokens and Argon2 password hashing |
| Verification | Pytest, HTTPX, Node.js tests and a full-stack integration check |

```text
React interface → /api/v1 → FastAPI services → PostgreSQL
```

- [`frontend/`](frontend/README.md): interface, API client, forms and frontend tests.
- [`backend/`](backend/README.md): API, authentication, billing logic, reports and worker commands.
- [`database/`](database/README.md): schema export, versioned migrations, Docker configuration and ignored local data.
- `scripts/`: launch the application and check the connection between all three layers.

During development, Vite forwards `/api` requests to FastAPI. For a single-origin build, run `npm run build` and start the backend; FastAPI serves the built interface at [http://127.0.0.1:8000](http://127.0.0.1:8000) alongside the API.

## Verify the project

Run these commands from the project root:

```bash
npm run test:frontend
npm run build
npm run check:stack
```

The stack check uses a disposable PostgreSQL schema to verify registration, authentication, subscriptions, billing, payments, reports, PDFs and customer isolation through the actual JavaScript client and API. It checks the persisted financial records and cleans up its test schema afterward. Your configured database role must be able to create test schemas.

See the [backend testing instructions](backend/README.md#verification) and [recorded verification results](backend/VERIFICATION.md) for more details.

## Configuration and current scope

- **Email:** Development messages are saved to `backend/.mail/`. Configure SMTP to deliver password resets and invoice emails to inboxes, and set `FRONTEND_URL` to your application address.
- **Payments:** The application records payments already received. It does not charge cards or connect to a payment gateway.
- **Automation:** Recurring billing and expiry workers are included; schedule them separately for automatic operation.
- **Local development:** Ctrl+C stops servers started by the launcher; PostgreSQL stays running. Restart the launcher after backend code changes. Frontend changes refresh through Vite.
- **Private files:** Keep credentials in `.env` and personal documents in `personal/`, `private/` or `local-only/`. Ignore rules protect common private files, but do not detect secrets pasted into source code or remove previously committed files.

Environment templates are available in [`frontend/.env.example`](frontend/.env.example) and [`backend/.env.example`](backend/.env.example). Use placeholders in committed templates and keep actual credentials out of GitHub.
