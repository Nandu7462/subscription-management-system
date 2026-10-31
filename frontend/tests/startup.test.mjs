import test from 'node:test'
import assert from 'node:assert/strict'
import { apiReady } from '../../scripts/health.mjs'

test('startup rejects a Vite HTML fallback with status 200 as an API health check', async () => {
  assert.equal(await apiReady('http://localhost/api/v1/health/ready', async () => new Response('<html>Brightloop</html>')), false)
})

test('startup accepts a ready backend response through the frontend proxy', async () => {
  assert.equal(await apiReady('http://localhost/api/v1/health/ready', async () => Response.json({ status: 'ready' })), true)
})

test('startup rejects unavailable and malformed API responses', async () => {
  assert.equal(await apiReady('http://localhost/api/v1/health/ready', async () => Response.json({ status: 'ready' }, { status: 503 })), false)
  assert.equal(await apiReady('http://localhost/api/v1/health/ready', async () => Response.json({ status: 'healthy' })), false)
})
