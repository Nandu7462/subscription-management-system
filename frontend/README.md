# Brightloop frontend

React + Vite interface connected to the FastAPI backend. All business records come from the API; there are no mocked dashboard totals or embedded credentials.

From the project root, run `npm run dev` to start the configured database, apply migrations, and launch the backend and frontend. See the root README for first-time setup.

To run just this directory:

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The backend must run on port 8000. Vite forwards `/api` to it; `.env.example` documents alternate API URLs. Run `npm run build` for a production bundle and `npm test` for the API client tests.

The frontend includes:

- Sign in, customer registration, forgotten password, and the emailed `/reset-password?token=...` route.
- Staff/admin dashboard using live financial reports and subscription counts; customer dashboard using only their own records.
- Paginated resource tables with status filters and a search of the current page.
- Product, variant, plan, tax, discount and staff-account forms with role restrictions.
- Quotation templates and draft subscriptions with customer/plan/product/variant/tax selectors; optional creation from templates.
- Subscription quotation/confirmation/activation/pause/resume/renewal/closure and discount assignment.
- Invoice confirmation, cancellation, email, authenticated PDF download and payment history.
- Payment recording with a stable idempotency key, and administrator-only reversals.

JWTs are held in per-tab session storage and attached as bearer tokens. Expiry returns the app to sign-in. Roles control visible navigation/actions; the backend independently enforces permissions and ownership. Monetary request values remain decimal strings. The UI formats numbers for display without choosing a currency that the backend does not specify.

Browser checks use the isolated test stack (`npm run check:stack -- --serve` from the root), never application records. That test-only administrator uses a fixed password in the test harness; the normal database has no default administrator. Set up your own administrator through the backend CLI.

For deployment, serve `dist/` behind the same origin as `/api`, or set `VITE_API_URL` at build time and configure backend CORS. FastAPI also serves the built `frontend/dist` directory directly at port 8000, including the password-reset page; unknown API routes remain JSON 404s.
