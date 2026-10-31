import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, ApiError } from '../src/api.js'

function storage() {
  const values = new Map()
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

test('login saves bearer token and subsequent requests carry it, logout removes it', async () => {
  const requests = []
  const cache = storage()
  const api = createClient({ baseURL: 'http://example.test/api/v1/', storage: cache, fetcher: async (url, options) => {
    requests.push({ url, ...options })
    return url.endsWith('/auth/login') ? json({ access_token: 'token-123' }) : json({ email: 'test@example.com', role: 'customer' })
  } })
  await api.login('test@example.com', 'Password!9')
  assert.equal(requests[0].url, 'http://example.test/api/v1/auth/login')
  assert.equal(requests[0].headers.Authorization, undefined)
  assert.equal(requests[1].headers.Authorization, 'Bearer token-123')
  assert.equal(api.hasToken(), true)
  api.logout()
  assert.equal(api.hasToken(), false)
})

test('expired token clears the session and signals the app', async () => {
  let expired = false
  const api = createClient({ storage: storage(), onUnauthorized: () => { expired = true }, fetcher: async () => json({ detail: 'Expired credentials' }, 401) })
  api.setToken('expired')
  await assert.rejects(api.request('/auth/me'), error => error instanceof ApiError && error.status === 401)
  assert.equal(expired, true)
  assert.equal(api.hasToken(), false)
})

test('bad login does not revoke an existing session through the unauthorized callback', async () => {
  let expired = false
  const api = createClient({ storage: storage(), onUnauthorized: () => { expired = true }, fetcher: async () => json({ detail: 'Incorrect password' }, 401) })
  await assert.rejects(api.login('user@example.com', 'bad'), /Incorrect password/)
  assert.equal(expired, false)
})

test('Pydantic validation errors include readable field locations', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => json({ detail: [{ loc: ['body', 'lines', 0, 'quantity'], msg: 'Input should be greater than 0' }] }, 422) })
  await assert.rejects(api.request('/subscriptions', { method: 'POST', body: {} }), /lines · 0 · quantity: Input should be greater than 0/)
})

test('lookup pagination follows all pages instead of silently stopping at 100', async () => {
  const api = createClient({ storage: storage(), fetcher: async url => {
    const offset = Number(new URL(url).searchParams.get('offset'))
    return json({ total: 105, items: Array.from({ length: offset ? 5 : 100 }, (_, i) => ({ id: offset + i })) })
  }, baseURL: 'http://example.test/api/v1' })
  const rows = await api.all('/products')
  assert.equal(rows.length, 105)
  assert.equal(rows[104].id, 104)
})

test('network errors explain the connection failure', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => { throw new TypeError('fetch failed') } })
  await assert.rejects(api.request('/health'), /Cannot reach the server/)
})

test('PDF downloads use the authenticated request and return a blob', async () => {
  const api = createClient({ storage: storage(), fetcher: async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer pdf-token')
    return new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })
  } })
  api.setToken('pdf-token')
  const pdf = await api.request('/invoices/id/pdf', { blob: true })
  assert.equal(await pdf.text(), '%PDF-1.4')
})

test('a frontend 404 on login explains how to restore the missing API proxy', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => new Response('', { status: 404 }) })
  await assert.rejects(api.login('test@example.com', 'Password!9'), error => error.status === 404 && /connection is missing.*npm run dev/.test(error.message))
})

test('an HTML page returned in place of API JSON explains the connection issue', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => new Response('<html>Frontend</html>', { status: 200 }) })
  await assert.rejects(api.request('/health/ready'), /invalid response.*frontend\/backend connection/)
})

test('a proxy gateway failure explains that the backend is unavailable', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => new Response('', { status: 502 }) })
  await assert.rejects(api.request('/auth/me'), /Cannot reach the backend/)
})

test('a real API not-found response preserves its resource error', async () => {
  const api = createClient({ storage: storage(), fetcher: async () => json({ detail: 'Invoice not found' }, 404) })
  await assert.rejects(api.request('/invoices/missing'), error => error.message === 'Invoice not found')
})
