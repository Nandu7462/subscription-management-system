import assert from 'node:assert/strict'
import { createClient } from '../src/api.js'
import { today } from '../src/format.js'

const baseURL = process.env.STACK_TEST_BASE
const password = process.env.STACK_TEST_PASSWORD
if (!baseURL || !password) throw new Error('Run this check through npm run check:stack from the project root.')
const client = () => createClient({ baseURL, storage: { getItem() { return null }, setItem() {}, removeItem() {} } })
const admin = client(), customer = client(), outsider = client()
const post = (api, path, body) => api.request(path, { method: 'POST', ...(body !== undefined ? { body } : {}) })

assert.equal((await admin.request('/health/ready', { authenticated: false })).status, 'ready')
assert.equal((await admin.login('stack-admin@example.com', password)).role, 'admin')
const registered = await post(customer, '/auth/register', { email: 'stack-customer@example.com', password, business_name: 'Integration Customer' })
await customer.login(registered.email, password)
await post(outsider, '/auth/register', { email: 'stack-outsider@example.com', password, business_name: 'Other Customer' })
await outsider.login('stack-outsider@example.com', password)
const profile = (await admin.all('/customers')).find(row => row.user_id === registered.id)
assert.ok(profile)
const product = await post(admin, '/products', { name: 'Software seat', sales_price: '1000.00' })
const variant = await post(admin, `/products/${product.id}/variants`, { attribute_name: 'Brand', attribute_value: 'Odoo', price_extra: '560.00' })
const plan = await post(admin, '/plans', { name: 'Business Monthly', price: '0.00', billing_interval: 'monthly', allow_early_close: true })
const tax = await post(admin, '/taxes', { name: 'Illustrative tax', rate: '18' })
const discount = await post(admin, '/discounts', { name: 'Welcome offer', type: 'percentage', value: '10', usage_limit: 1 })
const template = await post(admin, '/quotation-templates', { name: 'Business offer', plan_id: plan.id, validity_days: 30,
  lines: [{ product_id: product.id, variant_id: variant.id, quantity: 2, tax_rule_id: tax.id }] })
const sub = await post(admin, '/subscriptions/from-template', { template_id: template.id, customer_id: profile.id, start_date: today() })
await post(admin, `/subscriptions/${sub.id}/discounts`, { discount_id: discount.id })
for (const action of ['quote', 'confirm', 'activate']) await post(admin, `/subscriptions/${sub.id}/${action}`)
const invoice = (await admin.all('/invoices'))[0]
assert.equal(invoice.total, '3313.44')
assert.equal((await post(admin, `/subscriptions/${sub.id}/invoices/generate`)).count, 0)
await assert.rejects(customer.request(`/portal/invoices/${invoice.id}`), error => error.status === 404)
await post(admin, `/invoices/${invoice.id}/confirm`)
const firstPayment = { amount: '1000.00', method: 'upi', payment_date: today(), idempotency_key: 'stack-check-first-payment' }
const first = await post(admin, `/invoices/${invoice.id}/payments`, firstPayment)
assert.equal((await post(admin, `/invoices/${invoice.id}/payments`, firstPayment)).id, first.id)
assert.equal((await customer.request(`/portal/invoices/${invoice.id}`)).outstanding_amount, '2313.44')
await post(admin, `/invoices/${invoice.id}/payments`, { ...firstPayment, amount: '2313.44', idempotency_key: 'stack-check-final-payment' })
assert.equal((await admin.request(`/invoices/${invoice.id}`)).status, 'paid')
await post(admin, `/payments/${first.id}/reverse`, { reason: 'Integration test reversal' })
const report = await admin.request('/reports/summary')
assert.equal(report.active_subscriptions, 1)
assert.equal(report.collected_payments, '2313.44')
assert.equal(report.outstanding_amount, '1000.00')
await assert.rejects(outsider.request(`/portal/invoices/${invoice.id}`), error => error.status === 404)
assert.equal((await outsider.request('/portal/subscriptions')).total, 0)
await assert.rejects(customer.request('/reports/summary'), error => error.status === 403)
const pdf = await customer.request(`/portal/invoices/${invoice.id}/pdf`, { blob: true })
assert.ok((await pdf.text()).startsWith('%PDF'))
console.log('PASS: JavaScript client → Vite proxy → FastAPI → PostgreSQL')
console.log('PASS: registration, JWT login, product/variant, tax/discount, quotation, activation, duplicate protection, invoices, idempotent payments, reversal, reports, PDF, customer ownership')
